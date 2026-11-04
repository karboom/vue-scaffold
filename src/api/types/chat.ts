/**
 * AI 聊天域类型（real/mock 共用）
 * 信封协议推送三连：start 建气泡、delta 追加、done 收口
 */

export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
    id: string
    role: ChatRole
    content: string
    /** 流式在途标记：assistant 气泡收 delta 追加、done 到达后翻 false */
    streaming: boolean
    createdAt: number
}

/** 历史 ack 的应答 body */
export type ChatHistoryBody = {
    messages: ChatMessage[]
}

/** 客户端 -> 服务端的出站 body（list 走 ack 配对，send 走 fire-and-forget） */
export type ChatOutgoing = { action: 'list' } | { action: 'send'; text: string }

/** 服务端 -> 客户端的推送 body：非应答包（msgId 不与请求配对），按 type 判别 */
export type ChatIncoming =
    | { type: 'start'; messageId: string }
    | { type: 'delta'; messageId: string; delta: string }
    | { type: 'done'; messageId: string }
