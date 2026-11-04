/**
 * AI 聊天域真实现：websocket 信封协议用法的示例正文——
 * - 历史 = emitCustomAck（msgId 配对应答，IOCtx 四态由调用方 ctx 收口）
 * - 发送 = emitCustom（fire-and-forget，不等 ack）
 * - 回复 = listenCustom（服务端主动推送，start/delta/done 流式三连）
 * VITE_API_MOCK=on 时 '@/api' alias 把本模块整体替换为 mock/chat 的同签名替身
 */
import { aiSocket } from '@/api/client'
import type { IOCtx } from '@/utils/io'
import type { SocketUnsubscribe } from '@/utils/websocket'
import type { ChatHistoryBody, ChatIncoming, ChatMessage, ChatOutgoing } from '../types/chat'

export type * from '../types/chat'

// 信封事件名：服务端（/ai 命名空间）实现须与这里同名同协议
const HISTORY_EVENT = 'chat_history'
const CHAT_EVENT = 'chat'

// 历史 ack：map 在 socket 层的 run 内部把 body 整形为 messages 数组。
// 注意：emitCustomAck 自带 IOCtx.run 生命周期，store 侧直接 await 本函数，切勿再包一层 run
export const fetchChatHistory = (io: IOCtx<ChatMessage[]>): Promise<ChatMessage[]> =>
    aiSocket.emitCustomAck(
        io,
        HISTORY_EVENT,
        { action: 'list' } satisfies ChatOutgoing,
        (body: ChatHistoryBody) => body.messages,
    )

// 发送：只投递不等待，回复内容全部来自 CHAT_EVENT 的推送流
export const sendChat = (text: string): void => {
    const body: ChatOutgoing = { action: 'send', text }
    aiSocket.emitCustom(CHAT_EVENT, body)
}

// 订阅推送：返回退订句柄，页面卸载必须调用，否则监听随反复挂载叠加
export const subscribeChat = (handler: (incoming: ChatIncoming) => void): SocketUnsubscribe =>
    aiSocket.listenCustom(CHAT_EVENT, data => handler(data as ChatIncoming))
