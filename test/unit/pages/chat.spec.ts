import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// 拦截 api 模块：store 走的是 '@/api/chat'（vitest 下解析到 real），单测只验证编排与流式 reducer
// fetchChatHistory 替身保持与真实现同一契约：内部自跑 io.run，调用方不再包 run
vi.mock('@/api/chat', async () => {
    const seed = [{ id: 'seed_1', role: 'assistant', content: '你好', streaming: false, createdAt: 0 }]
    return {
        fetchChatHistory: vi.fn(async (io: { run: (fn: () => Promise<unknown>) => Promise<void>; data: unknown }) => {
            await io.run(() => Promise.resolve(seed))
            return io.data
        }),
        sendChat: vi.fn(),
        subscribeChat: vi.fn(() => vi.fn()),
    }
})

import { sendChat, subscribeChat } from '@/api/chat'
import { chatStore } from '@/pages/chat/store'

describe('聊天页 store：信封流式 reducer', () => {
    beforeEach(() => {
        localStorage.clear()
        setActivePinia(createPinia())
        vi.clearAllMocks()
    })

    it('历史 ack 成功：播种 messages 并进入 success 态', async () => {
        const store = chatStore('t')()

        await store.loadHistory()

        expect(store.remote.historyIo.status).toBe('success')
        expect(store.local.messages).toHaveLength(1)
        expect(store.local.messages[0].id).toBe('seed_1')
    })

    it('主动推送先于历史 ack 上屏：合并保留在途占位，不被覆盖抹掉', async () => {
        const store = chatStore('t')()
        const loading = store.loadHistory()
        // ack 尚未落地时，服务端主动推送已经建了占位气泡
        store.applyIncoming({ type: 'start', messageId: 'proactive_1' })
        store.applyIncoming({ type: 'delta', messageId: 'proactive_1', delta: '维护提醒' })

        await loading

        const ids = store.local.messages.map(item => item.id)
        expect(ids).toContain('seed_1') // 历史照常播种
        expect(ids).toContain('proactive_1') // 在途占位没被覆盖抹掉
        const bubble = store.local.messages.find(item => item.id == 'proactive_1')!
        expect(bubble.content).toBe('维护提醒')
    })

    it('发送：用户气泡立即上屏、清空输入、sendChat 被调用', () => {
        const store = chatStore('t')()
        store.local.input = ' 你好 AI '

        store.send()

        expect(sendChat).toHaveBeenCalledWith('你好 AI')
        expect(store.local.input).toBe('')
        expect(store.local.streaming).toBe(true)
        const last = store.local.messages.at(-1)!
        expect(last.role).toBe('user')
        expect(last.content).toBe('你好 AI')
    })

    it('空输入或在途回复：拒绝再次发送', () => {
        const store = chatStore('t')()

        store.send()
        expect(sendChat).not.toHaveBeenCalled()

        store.local.input = 'x'
        store.local.streaming = true
        store.send()
        expect(sendChat).not.toHaveBeenCalled()
    })

    it('start/delta/done：占位建气泡、逐段追加、收口清流式标记', () => {
        const store = chatStore('t')()

        store.applyIncoming({ type: 'start', messageId: 'ai_1' })
        expect(store.local.streaming).toBe(true)
        expect(store.local.messages.at(-1)!.streaming).toBe(true)

        store.applyIncoming({ type: 'delta', messageId: 'ai_1', delta: '你' })
        store.applyIncoming({ type: 'delta', messageId: 'ai_1', delta: '好' })
        expect(store.local.messages.at(-1)!.content).toBe('你好')

        store.applyIncoming({ type: 'done', messageId: 'ai_1' })
        expect(store.local.streaming).toBe(false)
        expect(store.local.messages.at(-1)!.streaming).toBe(false)
    })

    it('无占位的迟到片段：丢弃并告警，不污染消息列表', () => {
        const store = chatStore('t')()

        store.applyIncoming({ type: 'delta', messageId: 'ghost', delta: 'x' })

        expect(store.local.messages).toHaveLength(0)
        expect(store.local.streaming).toBe(false)
    })

    it('connect/disconnect：退订句柄只执行一次，重复 disconnect 无副作用', () => {
        const unsubscribe = vi.fn()
        vi.mocked(subscribeChat).mockReturnValue(unsubscribe)
        const store = chatStore('t')()

        store.connect()
        store.disconnect()
        expect(unsubscribe).toHaveBeenCalledOnce()

        store.disconnect()
        expect(unsubscribe).toHaveBeenCalledOnce()
        expect(store.local.subscription).toBeNull()
    })
})
