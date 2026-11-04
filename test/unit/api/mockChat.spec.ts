import { afterEach, describe, expect, it, vi } from 'vitest'
import { IOCtx } from '@/utils/io'
import type { ChatIncoming, ChatMessage } from '@/api/types/chat'
// 直接引 mock 本体（绕开 '@/api' 别名），钉死替身的信封同构行为
import { fetchChatHistory, sendChat, subscribeChat } from '../../../src/api/mock/chat'

describe('chat mock 替身：与真信封协议同构', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('历史自带 IOCtx 生命周期，成功态返回种子消息', async () => {
        const io = new IOCtx<ChatMessage[]>([])

        const messages = await fetchChatHistory(io)

        expect(io.status).toBe('success')
        expect(io.hasLoaded).toBe(true)
        expect(messages.length).toBeGreaterThan(0)
    })

    it('订阅后发送：start/delta/done 三连，片段可还原完整回复', async () => {
        vi.useFakeTimers()
        const incoming: ChatIncoming[] = []
        const unsubscribe = subscribeChat(msg => incoming.push(msg))

        sendChat('你好')
        await vi.advanceTimersByTimeAsync(20_000)
        unsubscribe()

        expect(incoming[0].type).toBe('start')
        expect(incoming.at(-1)?.type).toBe('done')
        const text = incoming
            .filter(msg => msg.type == 'delta')
            .map(msg => (msg as { delta: string }).delta)
            .join('')
        expect(text).toContain('你好')
    })

    it('无人订阅时发送：不排程、不抛错', () => {
        vi.useFakeTimers()

        expect(() => sendChat('孤寡')).not.toThrow()
    })

    it('订阅后一条不发：服务端仍主动推来 start/delta/done', async () => {
        vi.useFakeTimers()
        const incoming: ChatIncoming[] = []
        const unsubscribe = subscribeChat(msg => incoming.push(msg))

        // 上膛后 2~3s 自发起，全程用户没有任何发送动作
        await vi.advanceTimersByTimeAsync(30_000)
        unsubscribe()

        expect(incoming.length).toBeGreaterThan(0)
        expect(incoming[0].type).toBe('start')
        expect(incoming.at(-1)?.type).toBe('done')
        const text = incoming
            .filter(msg => msg.type == 'delta')
            .map(msg => (msg as { delta: string }).delta)
            .join('')
        expect(text).toContain('定时维护')
    })
})
