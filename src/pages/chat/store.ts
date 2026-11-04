import { defineStore } from 'pinia'
import { IOCtx } from '@/utils/io'
import * as log from '@/utils/log'
import type { SocketUnsubscribe } from '@/utils/websocket'
import { fetchChatHistory, sendChat, subscribeChat, type ChatIncoming, type ChatMessage } from '@/api/chat'

/**
 * AI 聊天页状态：websocket 信封协议的示例消费方
 * 渲染真源是 local.messages（历史种子 + 本地发送 + 流式占位），historyIo 只负责 ReadData 四态
 * 用法：chatStore(id)()
 */

export type LocalState = {
    input: string
    messages: ChatMessage[]
    /** 有在途的 AI 回复：禁用发送并展示打字动画 */
    streaming: boolean
    /** 推送退订句柄：非渲染数据，借 local 的生命周期随卸载一并释放 */
    subscription: SocketUnsubscribe | null
}

export type RemoteState = {
    historyIo: IOCtx<ChatMessage[]>
}

export type ChatState = {
    local: LocalState
    remote: RemoteState
}

export const chatStore = (id: string) =>
    defineStore(`chat_${id}`, {
        state: (): ChatState => ({
            local: {
                input: '',
                messages: [],
                streaming: false,
                subscription: null,
            },
            remote: {
                historyIo: new IOCtx<ChatMessage[]>([]),
            },
        }),
        getters: {
            canSend(): boolean {
                return this.local.input.trim() != '' && !this.local.streaming
            },
        },
        actions: {
            connect() {
                log.info('订阅聊天推送流')
                this.local.subscription = subscribeChat(incoming => this.applyIncoming(incoming))
            },
            disconnect() {
                if (this.local.subscription) {
                    log.info('退订聊天推送流')
                    this.local.subscription()
                    this.local.subscription = null
                }
            },
            async loadHistory() {
                log.info('加载聊天历史')
                const io = this.remote.historyIo
                // chat 域函数自带 IOCtx 生命周期（emitCustomAck 内部 run），这里再包一层会内外互相 abort；
                // 失败/取消由 io 状态机呈现（ReadData），抛出的 settle 错误在此截流，只留日志
                try {
                    await fetchChatHistory(io)
                } catch (e) {
                    log.warn('聊天历史加载未成功', io.status, e)
                }
                // ack 成功后播种渲染源：io.data 是协议层，local.messages 是展示层。
                // 主动推送可能先于 ack 上屏，因此是"合并"而非"覆盖"：
                // 本地已有但不在历史里的消息（在途流式占位、ack 前已发送的用户气泡）按 id 保留
                if (io.status == 'success') {
                    const seeded = io.data.map(msg => ({ ...msg }))
                    const live = this.local.messages.filter(msg => !seeded.some(item => item.id == msg.id))
                    this.local.messages = [...seeded, ...live]
                }
            },
            /** 纯 reducer：start 建占位、delta 追加、done 收口；单测直打这里，不经推送层 */
            applyIncoming(incoming: ChatIncoming) {
                if (incoming.type == 'start') {
                    log.info('AI 回复开始', incoming.messageId)
                    this.local.streaming = true
                    this.local.messages.push({
                        id: incoming.messageId,
                        role: 'assistant',
                        content: '',
                        streaming: true,
                        createdAt: Date.now(),
                    })
                    return
                }

                const message = this.local.messages.find(item => item.id == incoming.messageId)
                if (!message) {
                    // 无占位的迟到/乱序片段：丢弃并告警，与 websocket 内核"丢弃迟到应答"同一姿态
                    log.warn('收到无占位的消息片段', incoming.messageId)
                    return
                }

                if (incoming.type == 'delta') {
                    message.content += incoming.delta
                    return
                }
                message.streaming = false
                this.local.streaming = false
                log.info('AI 回复收口', incoming.messageId)
            },
            send() {
                const text = this.local.input.trim()
                if (text == '' || this.local.streaming) {
                    return
                }
                log.info('发送聊天消息', text)
                this.local.messages.push({
                    id: `me_${Date.now()}`,
                    role: 'user',
                    content: text,
                    streaming: false,
                    createdAt: Date.now(),
                })
                this.local.input = ''
                this.local.streaming = true
                // fire-and-forget：状态推进全部来自推送流；done 丢失属协议事故，留待真实后端联调时按事件加兜底超时
                sendChat(text)
            },
        },
    })
