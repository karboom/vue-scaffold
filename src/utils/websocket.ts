/**
 * socket.io 客户端工厂：与 utils/http 的 createHttp 同构，
 * 每个实例自持连接、订阅表与 msgId 配对队列，用于多后端（消息/实时看板）、多租户与测试隔离。
 * 应用级实例见 @/api/client（aiSocket）。传输层不做 mock 替换：mock 模式的假象全部收敛在业务域替身
 * （@/api/*），纪律是 mock 下不得有人直接调用本工厂实例——懒建连保证没人碰就绝无网络流量。
 */
import { io, type Socket } from 'socket.io-client'
import { CanceledError } from 'axios'
import type { IOCtx } from '@/utils/io'
import * as log from '@/utils/log'

export type SocketOptions = {
    /** 连接地址（含命名空间路径），凭证由工厂拼进 query */
    url: string
    /**
     * 取 token 的惰性函数：只在建连/重连时才读，
     * 既不在模块导入期依赖已激活的 pinia，重连也总能拿到当下最新凭证
     */
    token: () => string
    /** 等待服务端应答的上限，默认 10000ms */
    ackTimeout?: number
}

/** 业务信封协议：请求带 msgId，服务端应答与主动推送按同一 msgId 回带 */
export type SocketEnvelope = {
    msgId: string
    body: any
}

export type SocketListener = (data: any) => void

/** 退订句柄：组件卸载时必须调用，否则监听会随反复挂载叠加 */
export type SocketUnsubscribe = () => void

type PendingAck = {
    resolve: (value: any) => void
    reject: (reason: unknown) => void
}

export const createSocket = (options: SocketOptions) => {
    const ackTimeout = options.ackTimeout ?? 10000

    // 懒连接：没有收发诉求就不握手，登录页/单测/SSR 都不会产生连接
    let socket: Socket | null = null

    const getSocket = (): Socket => {
        if (socket) {
            return socket
        }

        const url = `${options.url}?token=${options.token()}`
        log.info('建立 socket 连接', url)
        socket = io(url, {
            transports: ['websocket'],
            autoConnect: true,
            reconnection: true,
        })
        return socket
    }

    /** pending 配对队列：key 为 `${event}:${msgId}` */
    const ackQueue = new Map<string, PendingAck>()
    /** 本实例发出过的请求 msgId：应答包即使已经超时/被接管也不该当成主动推送扇出 */
    const requestMsgIds = new Set<string>()
    /** 已挂过信封监听的事件：一个事件只挂一次，多路请求与订阅共用 */
    const envelopeEvents = new Set<string>()
    /** 信封事件的订阅者：服务端主动推送的 body 扇出到这里 */
    const envelopeListeners = new Map<string, Set<SocketListener>>()

    /**
     * socket 原生没有 abort 语义：借 IOCtx 的取消信号给在途请求补一个取消出口，
     * 超时转 Error、取消转 CanceledError，最终状态仍由 ctx.run() 统一收口
     */
    const awaitAck = <T>(ctx: IOCtx<T>, label: string, task: () => Promise<T>): Promise<T> =>
        new Promise<T>((resolve, reject) => {
            const signal = ctx.controller.signal

            const cleanup = () => {
                clearTimeout(timer)
                signal.removeEventListener('abort', onAbort)
            }

            const onAbort = () => {
                log.info('socket 请求被取消', label)
                cleanup()
                reject(new CanceledError())
            }

            const timer = setTimeout(() => {
                log.warn('socket 应答超时', `${label} ${ackTimeout}ms`)
                cleanup()
                reject(new Error(`socket 应答超时：${label}`))
            }, ackTimeout)

            signal.addEventListener('abort', onAbort, { once: true })

            task().then(
                value => {
                    cleanup()
                    resolve(value)
                },
                error => {
                    cleanup()
                    reject(error)
                },
            )
        })

    /** 把 ack 结果按 IOCtx 状态机抛出去：与 http 域 api 的收口写法一致 */
    const settle = <T>(ctx: IOCtx<T>): T => {
        if (ctx.status == 'error') {
            throw ctx.error
        }
        if (ctx.status == 'canceled') {
            throw new CanceledError()
        }
        return ctx.data
    }

    /** 裸协议发送：fire-and-forget，负载直接是业务 JSON */
    const emit = (event: string, data: object) => {
        log.info(`发送事件 ${event}`, data)
        getSocket().emit(event, JSON.stringify(data))
    }

    /**
     * 裸协议请求-应答：走 socket.io 自带 ack。
     * 生命周期（loading/refreshing/error/data 回写、过期结果不覆盖）统一交给 IOCtx.run()
     */
    const emitAck = async (ctx: IOCtx<any>, event: string, data: object) => {
        log.info(`请求应答 ${event}`, data)

        await ctx.run(() =>
            awaitAck(ctx, event, () => getSocket().timeout(ackTimeout).emitWithAck(event, JSON.stringify(data))),
        )

        return settle(ctx)
    }

    /** 订阅裸协议推送，返回退订句柄 */
    const listen = (event: string, func: SocketListener): SocketUnsubscribe => {
        log.info(`订阅事件 ${event}`)

        const handler = (payload: string) => {
            log.info(`收到推送 ${event}`, payload)
            func(JSON.parse(payload))
        }

        getSocket().on(event, handler)

        return () => {
            log.info(`退订事件 ${event}`)
            getSocket().off(event, handler)
        }
    }

    /** 自增 msgId：同一实例内唯一即可，跨连接不需要全局唯一 */
    let msgIdCounter = 0
    const nextMsgId = () => `${Date.now()}_${String(++msgIdCounter)}`

    /** 信封报文分发：应答包按 msgId 回到 pending 队列，主动推送扇出给订阅者 */
    const dispatchEnvelope = (event: string, message: SocketEnvelope) => {
        const key = `${event}:${message.msgId}`
        const pending = ackQueue.get(key)
        if (pending) {
            log.info(`配对成功 ${key}`)
            ackQueue.delete(key)
            requestMsgIds.delete(message.msgId)
            pending.resolve(message.body)
            return
        }

        // 超时/取消后到达的迟到应答：摘掉痕迹后丢弃，别混进推送流
        if (requestMsgIds.delete(message.msgId)) {
            log.warn(`丢弃迟到应答 ${key}`)
            return
        }

        const subscribers = envelopeListeners.get(event)
        if (subscribers) {
            subscribers.forEach(func => func(message.body))
        }
    }

    /** 每个信封事件只注册一次 socket 监听，多路请求与订阅共用同一个 handler */
    const ensureEnvelope = (event: string) => {
        if (envelopeEvents.has(event)) {
            return
        }
        envelopeEvents.add(event)
        log.info(`注册信封监听 ${event}`)

        getSocket().on(event, (payload: string) => {
            log.info(`收到信封报文 ${event}`, payload)
            dispatchEnvelope(event, JSON.parse(payload) as SocketEnvelope)
        })
    }

    /** 信封协议发送：fire-and-forget，服务端如需应答请改用 emitCustomAck */
    const emitCustom = (event: string, data: object) => {
        emit(event, { msgId: nextMsgId(), body: data } as SocketEnvelope)
    }

    /** 订阅信封协议推送（回调直接拿到 body），返回退订句柄 */
    const listenCustom = (event: string, func: SocketListener): SocketUnsubscribe => {
        log.info(`订阅信封事件 ${event}`)
        ensureEnvelope(event)

        let subscribers = envelopeListeners.get(event)
        if (!subscribers) {
            subscribers = new Set<SocketListener>()
            envelopeListeners.set(event, subscribers)
        }
        subscribers.add(func)

        return () => {
            log.info(`退订信封事件 ${event}`)
            subscribers.delete(func)
        }
    }

    /**
     * 信封协议请求-应答：服务端在业务报文里回带同一 msgId 才算配对，
     * 超时/取消由 awaitAck 兜住，状态仍由 IOCtx.run() 收口。
     * map 在 run 内部把应答 body 整形为 ctx 的 data 类型——run 的所有权在 socket 层，
     * 调用方（api 域函数）绝不可再对同一 ctx 包一层 run，否则内外两层互相 abort
     */
    const emitCustomAck = async <R = any>(ctx: IOCtx<R>, event: string, data: object, map?: (body: any) => R) => {
        log.info(`信封请求应答 ${event}`, data)

        const msgId = nextMsgId()
        const key = `${event}:${msgId}`
        requestMsgIds.add(msgId)
        ensureEnvelope(event)

        await ctx.run(() =>
            awaitAck(
                ctx,
                key,
                () =>
                    new Promise<R>((resolve, reject) => {
                        ackQueue.set(key, {
                            resolve: value => resolve(map ? map(value) : (value as R)),
                            reject,
                        })
                        emit(event, { msgId, body: data } as SocketEnvelope)
                    }),
            ).finally(() => {
                // 超时/取消/被新请求接管都要摘掉占位，否则旧 msgId 永久滞留队列
                log.info(`清理配对队列 ${key}`)
                ackQueue.delete(key)
            }),
        )

        return settle(ctx)
    }

    /** 逃生口：需要直连 socket.io 生命周期事件（connect_error 等）时使用，会触发建连 */
    const raw = (): Socket => getSocket()

    /**
     * 断开并释放：清队列、清订阅、关连接；退出登录或实例销毁时调用。
     * 断开后再次收发会按最新 token 重新握手
     */
    const disconnect = () => {
        log.info('断开 socket 连接', options.url)

        ackQueue.forEach(pending => pending.reject(new CanceledError()))
        ackQueue.clear()
        requestMsgIds.clear()
        envelopeEvents.clear()
        envelopeListeners.clear()

        if (socket) {
            socket.off()
            socket.close()
            socket = null
        }
    }

    return {
        emit,
        emitAck,
        listen,
        emitCustom,
        emitCustomAck,
        listenCustom,
        raw,
        disconnect,
    }
}

export type SocketInstance = ReturnType<typeof createSocket>
