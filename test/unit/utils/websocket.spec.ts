import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanceledError } from 'axios'
import { IOCtx } from '@/utils/io'
import { createSocket } from '@/utils/websocket'

/**
 * 假 socket.io：只记录"发了什么、挂了哪些监听"，回包由测试自己扮演服务端触发，
 * 这样配对队列/超时/退订这些实例内逻辑可脱离真实服务端验证
 */
const stub = vi.hoisted(() => {
    const ioCalls: string[] = []
    const sent: { event: string; payload: string }[] = []
    const listeners = new Map<string, Set<(payload: string) => void>>()
    const acks: { event: string; resolve: (value: any) => void; reject: (reason: any) => void }[] = []
    let closed = 0

    const socket = {
        emit(event: string, payload: string) {
            sent.push({ event, payload })
        },
        on(event: string, handler: (payload: string) => void) {
            const set = listeners.get(event) ?? new Set<(payload: string) => void>()
            set.add(handler)
            listeners.set(event, set)
        },
        off(event: string, handler: (payload: string) => void) {
            listeners.get(event)?.delete(handler)
        },
        close() {
            closed += 1
        },
        timeout(_ms: number) {
            return {
                emitWithAck: (event: string) =>
                    new Promise((resolve, reject) => {
                        acks.push({ event, resolve, reject })
                    }),
            }
        },
    }

    return {
        ioCalls,
        sent,
        listeners,
        acks,
        socket,
        get closed() {
            return closed
        },
        reset() {
            closed = 0
        },
    }
})

vi.mock('socket.io-client', () => ({
    io: (url: string) => {
        stub.ioCalls.push(url)
        return stub.socket
    },
}))

const newSocket = (ackTimeout?: number) =>
    createSocket({ url: '/user', token: () => 'tk_test', ...(ackTimeout ? { ackTimeout } : {}) })

/** 微任务排空：resolve/reject 之后还需要几轮才落到 IOCtx 状态上 */
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

const lastSentEnvelope = () => JSON.parse(stub.sent[stub.sent.length - 1].payload) as { msgId: string; body: unknown }

const replyAck = (event: string, body: unknown) => {
    const ack = stub.acks.find(item => item.event == event)
    if (!ack) {
        throw new Error(`没有等待应答的 ${event} 请求`)
    }
    ack.resolve(body)
}

/** 服务端回信封包：只有 msgId 对上才应该让请求落地 */
const pushEnvelope = (event: string, msgId: string, body: unknown) => {
    stub.listeners.get(event)?.forEach(handler => handler(JSON.stringify({ msgId, body })))
}

beforeEach(() => {
    stub.ioCalls.length = 0
    stub.sent.length = 0
    stub.acks.length = 0
    stub.listeners.clear()
    stub.reset()
})

describe('socket 工厂：懒连接', () => {
    it('创建实例不建连，首次收发才带上惰性取到的 token 握手', () => {
        const ws = newSocket()
        expect(stub.ioCalls).toEqual([])

        ws.emit('ping', { a: 1 })

        expect(stub.ioCalls).toEqual(['/user?token=tk_test'])
        expect(stub.sent[0]).toEqual({ event: 'ping', payload: '{"a":1}' })
    })

    it('disconnect 关连接后，再次收发会重新握手', () => {
        const ws = newSocket()
        ws.emit('ping', {})
        ws.disconnect()

        expect(stub.closed).toBe(1)

        ws.emit('ping', {})
        expect(stub.ioCalls.length).toBe(2)
    })
})

describe('socket 工厂：裸协议 emitAck', () => {
    it('应答落地走 IOCtx 状态机，结果写回 ctx.data', async () => {
        const ws = newSocket()
        const ctx = new IOCtx<string>('')

        const promise = ws.emitAck(ctx, 'list_folder', { page: 1 })
        expect(ctx.status).toBe('loading')

        replyAck('list_folder', { code: 0 })
        const data = await promise

        expect(data).toEqual({ code: 0 })
        expect(ctx.status).toBe('success')
        expect(ctx.hasLoaded).toBe(true)
    })

    it('取消在途请求转成 CanceledError，状态落 canceled', async () => {
        const ws = newSocket()
        const ctx = new IOCtx<string>('')

        const promise = ws.emitAck(ctx, 'list_folder', {})
        ctx.controller.abort()

        await expect(promise).rejects.toBeInstanceOf(CanceledError)
        expect(ctx.status).toBe('canceled')
    })

    it('超过 ackTimeout 落 error 态', async () => {
        vi.useFakeTimers()
        const ws = newSocket(100)
        const ctx = new IOCtx<string>('')

        const promise = ws.emitAck(ctx, 'list_folder', {})
        // 先把断言挂上再推时钟，否则拒绝在挂 handler 前落地会被 Node 记成 unhandled rejection
        const rejected = expect(promise).rejects.toThrow('socket 应答超时：list_folder')
        await vi.advanceTimersByTimeAsync(150)
        await rejected

        expect(ctx.status).toBe('error')
        vi.useRealTimers()
    })
})

describe('socket 工厂：信封协议', () => {
    it('emitCustom 包上 msgId 信封', () => {
        newSocket().emitCustom('file_transfer', { path: '/a.txt' })

        const envelope = lastSentEnvelope()
        expect(envelope.body).toEqual({ path: '/a.txt' })
        expect(envelope.msgId).not.toBe('')
    })

    it('emitCustomAck 只认同一 msgId 的应答', async () => {
        const ws = newSocket()
        const ctx = new IOCtx<{ percent: number }>({ percent: 0 })

        const promise = ws.emitCustomAck(ctx, 'file_transfer', { path: '/a.txt' })
        const { msgId } = lastSentEnvelope()

        // 错包：不该让请求落地
        pushEnvelope('file_transfer', `${msgId}_other`, { percent: 99 })
        await flush()
        expect(ctx.status).toBe('loading')

        pushEnvelope('file_transfer', msgId, { percent: 100 })
        await expect(promise).resolves.toEqual({ percent: 100 })
        expect(ctx.data).toEqual({ percent: 100 })
        expect(ctx.status).toBe('success')
    })

    it('同一事件的信封监听只挂一次，应答包不混进推送流', async () => {
        const ws = newSocket()
        const bodies: unknown[] = []
        ws.listenCustom('notify', body => bodies.push(body))

        const first = ws.emitCustomAck(new IOCtx<unknown>(null), 'notify', { q: 1 })
        const firstMsgId = lastSentEnvelope().msgId
        const second = ws.emitCustomAck(new IOCtx<unknown>(null), 'notify', { q: 2 })
        const secondMsgId = lastSentEnvelope().msgId

        // 多路请求共用同一个 socket 级 handler
        expect(stub.listeners.get('notify')?.size).toBe(1)

        pushEnvelope('notify', firstMsgId, { q: 1, ok: true })
        pushEnvelope('notify', secondMsgId, { q: 2, ok: true })
        await expect(first).resolves.toEqual({ q: 1, ok: true })
        await expect(second).resolves.toEqual({ q: 2, ok: true })
        expect(bodies).toEqual([])

        // 服务端主动推才扇出给订阅者
        pushEnvelope('notify', 'server_push', { unread: 3 })
        expect(bodies).toEqual([{ unread: 3 }])
    })

    it('listen 与 listenCustom 退订后不再收到推送', () => {
        const ws = newSocket()
        const raw: unknown[] = []
        const custom: unknown[] = []

        const offRaw = ws.listen('notify', data => raw.push(data))
        const offCustom = ws.listenCustom('notify', body => custom.push(body))
        expect(stub.listeners.get('notify')?.size).toBe(2)

        offRaw()
        offCustom()
        pushEnvelope('notify', 'server_push', { unread: 3 })

        expect(raw).toEqual([])
        expect(custom).toEqual([])
        // 订阅者摘干净了，但 socket 级信封 handler 常驻，disconnect 才收
        expect(stub.listeners.get('notify')?.size).toBe(1)
    })
})
