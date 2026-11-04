import axios, { type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { createId } from './data'
import type { IOCtx } from './io'
import * as log from './log'

export type ReqHandler = (config: InternalAxiosRequestConfig) => void | Promise<void>
export type ResHandler = (error: unknown) => void | Promise<void>

export type HttpTelemetry = {
    requestId: string
    method: string
    url: string
    status: number | string
    duration: number
    /** 慢判定在上报侧完成：阈值是实例配置，消费方（Sentry/埋点）不该各自重算 */
    slow: boolean
    error?: unknown
}

export type HttpOptions = {
    /** 字符串 = 固定地址；函数 = 每次请求解析（SSR 下需要按请求补绝对 origin） */
    baseURL: string | (() => string)
    timeout?: number
    /** 超过该耗时按慢请求记录，默认 1000ms */
    slowRequestMs?: number
    /** 遥测上报钩子：可接 Sentry / 埋点 / 自建监控 */
    onTelemetry?: (event: HttpTelemetry) => void
}

/** 计时元数据挂 config 本体而非自管 Map：WeakMap 随请求对象一起回收，零清理逻辑 */
type RequestMeta = {
    requestId: string
    start: number
}

/**
 * 创建独立的 http 实例：各自持有 axios client、handler、遥测配置。
 * 用于多后端、多租户、SSR（token 来源不同）和测试隔离。
 */
export const createHttp = (options: HttpOptions) => {
    const slowRequestMs = options.slowRequestMs ?? 1000

    // baseURL 不在 client 上固化：函数形态要求每次请求现算（SSR 每请求 origin 不同）
    const resolveBaseURL = typeof options.baseURL == 'function' ? options.baseURL : () => options.baseURL as string

    const client = axios.create({
        timeout: options.timeout ?? 10000,
        headers: {},
    })

    const reqHandlers: ReqHandler[] = []
    const resHandlers: ResHandler[] = []
    const requestMeta = new WeakMap<InternalAxiosRequestConfig, RequestMeta>()

    /**
     * handler 用数组而非 Set：执行顺序 = 注册顺序（注入凭证的必须排在改 payload 的前面）；
     * 退订按引用摘除并返回反操作句柄，与 socket 域的 listen 保持同一使用姿势
     */
    const addReqHandler = (handler: ReqHandler) => {
        reqHandlers.push(handler)
        return () => {
            const index = reqHandlers.indexOf(handler)
            if (index >= 0) {
                reqHandlers.splice(index, 1)
            }
        }
    }

    /** 与 addReqHandler 同一套路：顺序执行 + 按引用退订，res 侧用于统一鉴权失效处理等横切关注点 */
    const addResHandler = (handler: ResHandler) => {
        resHandlers.push(handler)
        return () => {
            const index = resHandlers.indexOf(handler)
            if (index >= 0) {
                resHandlers.splice(index, 1)
            }
        }
    }

    /**
     * 请求前：注入 requestId、为 POST 生成幂等键、执行应用层 handler。
     * start 在 handler 之后记录，遥测只统计网络耗时。
     */
    const handleRequest = async (config: InternalAxiosRequestConfig) => {
        config.baseURL = resolveBaseURL()
        const requestId = String(config.headers['X-Request-Id'] ?? createId())
        config.headers['X-Request-Id'] = requestId

        if (String(config.method).toUpperCase() == 'POST' && !config.headers['Idempotency-Key']) {
            config.headers['Idempotency-Key'] = createId()
        }

        const meta: RequestMeta = { requestId, start: 0 }
        requestMeta.set(config, meta)

        for (const handler of reqHandlers) {
            await handler(config)
        }
        meta.start = performance.now()
        return config
    }

    /**
     * 成功/失败/取消的唯一记账出口。几个刻意的"不"：
     * - 没有 meta 或 start 仍为 0（handler 在计时前抛断）时直接放弃上报，不给半截数据编耗时；
     * - status 放宽成 string：取消与网络层失败没有 HTTP 码，用 CANCELED/错误码占位，消费方仍可比对；
     * - onTelemetry 包 try/catch：监控自身故障绝不允许拖垮业务请求；
     * - slow 在此判定而非交给消费方：阈值是实例配置（slowRequestMs），别让每个上报端重算一遍
     */
    const report = (status: number | string, config: InternalAxiosRequestConfig, error?: unknown) => {
        const meta = requestMeta.get(config)
        if (!meta || !meta.start) {
            return
        }

        const duration = Math.round(performance.now() - meta.start)
        const method = String(config.method).toUpperCase()
        const url = config.url ?? ''
        const slow = duration >= slowRequestMs

        try {
            options.onTelemetry?.({
                requestId: meta.requestId,
                method,
                url,
                status,
                duration,
                slow,
                error,
            })
        } catch (reportError) {
            // 遥测失败不能影响业务请求
            log.warn('HTTP 遥测回调异常', reportError)
        }

        const line = `${method} ${url} status=${status} ${duration}ms requestId=${meta.requestId}`
        if (error) {
            log.error('HTTP 请求失败', line)
            return
        }
        if (slow) {
            log.warn('HTTP 慢请求', line)
            return
        }
        log.info('HTTP 请求完成', line)
    }

    /** 成功路径只记账、原样透传：拆 data 的解包权留给 api 域函数，传输层不越层理解业务结构 */
    const handleResponse = (response: AxiosResponse) => {
        report(response.status, response.config)
        return response
    }

    /**
     * 失败也要有账，但取消例外：cancel 记 CANCELED 状态却不带 error 进遥测，
     * 否则切页/重发这类正常操作会污染错误看板；
     * handler 跑完后必须 rethrow——错误状态归 IOCtx.run 收口，拦截器只有知情权、没有吞并权
     */
    const handleResponseError = async (error: unknown) => {
        if (axios.isAxiosError(error) && error.config) {
            const canceled = axios.isCancel(error)
            report(
                canceled ? 'CANCELED' : (error.response?.status ?? error.code ?? 'NETWORK'),
                error.config,
                canceled ? undefined : error,
            )
        }

        for (const handler of resHandlers) {
            await handler(error)
        }
        throw error
    }

    client.interceptors.request.use(handleRequest)
    client.interceptors.response.use(handleResponse, handleResponseError)

    /**
     * 所有动词的统一入口。io 作为第一参数的唯一目的就是强制注入它的取消信号：
     * IOCtx.run 每次换新的 controller 由此接到 axios，请求取消不需要 api 域手动透传 signal——
     * 这也是全项目 api 函数签名都以 io 开头的根因
     */
    const req = (io: IOCtx<any>, params: AxiosRequestConfig) => {
        return client.request({
            ...params,
            signal: io.controller.signal,
        })
    }

    /** get/post/put：动词字面量焊死在代码里，杜绝调用点手填 method 字符串的拼写漂移；语义全在 req */
    const get = (io: IOCtx<any>, params: AxiosRequestConfig) => {
        return req(io, {
            ...params,
            method: 'GET',
        })
    }

    const post = (io: IOCtx<any>, params: AxiosRequestConfig) => {
        return req(io, {
            ...params,
            method: 'POST',
        })
    }

    const put = (io: IOCtx<any>, params: AxiosRequestConfig) => {
        return req(io, {
            ...params,
            method: 'PUT',
        })
    }

    // delete 是保留字，动词名为 del，请求仍是 DELETE
    const del = (io: IOCtx<any>, params: AxiosRequestConfig) => {
        return req(io, {
            ...params,
            method: 'DELETE',
        })
    }

    return {
        client,
        req,
        get,
        post,
        put,
        del,
        addReqHandler,
        addResHandler,
        handleRequest,
        handleResponse,
        handleResponseError,
    }
}
