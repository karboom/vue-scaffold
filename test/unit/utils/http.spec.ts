import { describe, expect, it, vi } from 'vitest'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { createHttp, type HttpTelemetry } from '@/utils/http'

const createConfig = (method = 'get') =>
    ({ headers: {}, method, url: '/test' }) as unknown as InternalAxiosRequestConfig

describe('http 请求前注入', () => {
    it('按注册顺序执行，并允许注入 header', async () => {
        const http = createHttp({ baseURL: '/api' })
        const order: string[] = []

        http.addReqHandler(config => {
            order.push('token')
            config.headers.Authorization = 'Bearer token'
        })
        http.addReqHandler(async config => {
            await Promise.resolve()
            order.push('trace')
            config.headers['X-Trace-Id'] = 'trace-id'
        })

        const config = createConfig()
        const result = await http.handleRequest(config)

        expect(result).toBe(config)
        expect(order).toEqual(['token', 'trace'])
        expect(config.headers.Authorization).toBe('Bearer token')
        expect(config.headers['X-Trace-Id']).toBe('trace-id')
    })

    it('卸载后不再执行', async () => {
        const http = createHttp({ baseURL: '/api' })
        const hook = vi.fn()
        const off = http.addReqHandler(hook)
        off()

        await http.handleRequest(createConfig())

        expect(hook).not.toHaveBeenCalled()
    })
})

describe('http 响应错误处理', () => {
    it('按注册顺序执行，并继续抛出原始错误', async () => {
        const http = createHttp({ baseURL: '/api' })
        const order: string[] = []
        const error = { isAxiosError: true, response: { status: 500 } }

        http.addResHandler(() => {
            order.push('log')
        })
        http.addResHandler(async () => {
            await Promise.resolve()
            order.push('notify')
        })

        await expect(http.handleResponseError(error)).rejects.toBe(error)

        expect(order).toEqual(['log', 'notify'])
    })

    it('卸载后不再执行', async () => {
        const http = createHttp({ baseURL: '/api' })
        const hook = vi.fn()
        const off = http.addResHandler(hook)
        off()

        const error = { isAxiosError: true, response: { status: 500 } }
        await expect(http.handleResponseError(error)).rejects.toBe(error)

        expect(hook).not.toHaveBeenCalled()
    })
})

describe('http 请求元数据', () => {
    it('注入 requestId，并为 POST 生成幂等键', async () => {
        const http = createHttp({ baseURL: '/api' })

        const post = createConfig('post')
        await http.handleRequest(post)

        expect(post.headers['X-Request-Id']).toBeTruthy()
        expect(post.headers['Idempotency-Key']).toBeTruthy()

        const get = createConfig('get')
        await http.handleRequest(get)

        expect(get.headers['X-Request-Id']).toBeTruthy()
        expect(get.headers['Idempotency-Key']).toBeUndefined()
    })

    it('保留调用方指定的 requestId 与幂等键', async () => {
        const http = createHttp({ baseURL: '/api' })
        const config = createConfig('post')
        config.headers['X-Request-Id'] = 'rid-1'
        config.headers['Idempotency-Key'] = 'idem-1'

        await http.handleRequest(config)

        expect(config.headers['X-Request-Id']).toBe('rid-1')
        expect(config.headers['Idempotency-Key']).toBe('idem-1')
    })

    it('不同实例的 handler 相互隔离', async () => {
        const a = createHttp({ baseURL: '/a' })
        const b = createHttp({ baseURL: '/b' })
        const handler = vi.fn()

        a.addReqHandler(handler)
        await b.handleRequest(createConfig())

        expect(handler).not.toHaveBeenCalled()
    })
})

describe('http 遥测', () => {
    it('成功响应上报耗时与状态', async () => {
        const events: HttpTelemetry[] = []
        const http = createHttp({
            baseURL: '/api',
            onTelemetry: event => events.push(event),
        })
        const config = await http.handleRequest(createConfig())
        http.handleResponse({ status: 200, config } as AxiosResponse)

        expect(events).toHaveLength(1)
        expect(events[0].method).toBe('GET')
        expect(events[0].status).toBe(200)
        expect(events[0].slow).toBe(false)
        expect(events[0].requestId).toBe(config.headers['X-Request-Id'])
        expect(events[0].duration).toBeGreaterThanOrEqual(0)
    })

    it('失败响应上报状态与原始错误', async () => {
        const events: HttpTelemetry[] = []
        const http = createHttp({
            baseURL: '/api',
            onTelemetry: event => events.push(event),
        })
        const config = await http.handleRequest(createConfig())
        const error = {
            isAxiosError: true,
            config,
            response: { status: 500 },
            code: 'ERR_BAD_RESPONSE',
            message: 'boom',
        }

        await expect(http.handleResponseError(error)).rejects.toBe(error)

        expect(events).toHaveLength(1)
        expect(events[0].status).toBe(500)
        expect(events[0].error).toBe(error)
    })
})
