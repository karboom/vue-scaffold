/**
 * AI 聊天 mock 替身：与 ../real/chat 同签名，但不经过 socket——
 * 传输层没有替身，本域替身就是 mock 模式假象的唯一来源（aiSocket 在 mock 下无人调用，懒建连=零流量）。
 * 流式回复复用 utils/mock 的 createBroadcaster + createStreamer：
 * 随机 0-1s"思考"延迟在前，罐头文本拆 2~6 字片段、片段间 30-90ms，
 * 推送形状经 StreamEvent 映射回真实信封 start/delta/done 完全同构，store 与页面零感知。
 * 真实现用相对路径导入（不受 '@/api' 别名影响），签名漂移会直接编译报错
 */
import type * as Real from '../real/chat'
import * as mock from '@/utils/mock'

// 罐头回复池：轮转使用；{question} 回显提问。演示数据非界面文案，按约定不走 i18n
const replyPool = [
    '收到你的问题：{question}。这是 mock 罐头回复，但流式协议与真实后端完全一致：start 建气泡、delta 逐段追加、done 收口。',
    '关于「{question}」，真实环境会由推理服务作答。把 VITE_API_MOCK 设为 off，同一份页面代码即可接上按同协议实现的 /ai 命名空间。',
    '{question} 好问题。我是纯前端假数据，不建任何真实连接；订阅、退订与流式拼接的逻辑都是真的。',
]

let replyCursor = 0

// 首屏历史罐头：fetchChatHistory 的假返回值（respond 缺省即约定：延迟随机 0-1s，让骨架态可感知）
const seedMessages: Real.ChatMessage[] = [
    {
        id: 'seed_1',
        role: 'assistant',
        content: '你好，我是 mock 模式的本地 AI 助手，试着发条消息给我。',
        streaming: false,
        createdAt: Date.now() - 60_000,
    },
    { id: 'seed_2', role: 'user', content: '你会流式输出吗？', streaming: false, createdAt: Date.now() - 30_000 },
    {
        id: 'seed_3',
        role: 'assistant',
        content: '会。下方我的每条回复都会按 start/delta/done 三连逐段推送，和真实推理服务的节奏一致。',
        streaming: false,
        createdAt: Date.now() - 10_000,
    },
]

const broadcaster = mock.createBroadcaster<Real.ChatIncoming>()

// 与真实现同一契约：本域函数自带 IOCtx.run 生命周期（真实现藏在 emitCustomAck 里），store 侧直接 await
export const fetchChatHistory: typeof Real.fetchChatHistory = async io => {
    await io.run(() => mock.respond(io, seedMessages))
    return io.data
}

// 流式引擎：应答与主动推送共用；抽象 StreamEvent 在这里落回 chat 域名义的信封
const streamText = mock.createStreamer({
    idPrefix: 'mock_ai',
    // 无人订阅（页面已卸载）：不排程，避免定时器幽灵推给死监听
    active: broadcaster.hasListeners,
    emit: event => {
        // 三分支各自构造：让 phase 与信封形状在编译期就锁死一一对应
        if (event.phase == 'start') {
            broadcaster.publish({ type: 'start', messageId: event.id })
        } else if (event.phase == 'delta') {
            broadcaster.publish({ type: 'delta', messageId: event.id, delta: event.delta })
        } else {
            broadcaster.publish({ type: 'done', messageId: event.id })
        }
    },
})

export const sendChat: typeof Real.sendChat = text => {
    // 取模恒在界内，兜空串只为满足 Nuxt 宿主的 noUncheckedIndexedAccess
    const template = replyPool[replyCursor++ % replyPool.length] ?? ''
    streamText(template.replace('{question}', text))
}

// —— 主动推送剧本：用户不发送任何东西，"服务端"自己开口 ——
// 真实后端等价：往同一 chat 事件直接推 start/delta/done 信封即可，客户端零改动。
// 首个订阅者就位后 2~3s 发起一条；每次页面挂载都可重演（listeners 从空转非空即重新上膛）
const proactiveText =
    '【主动推送】今晚 23:00 定时维护，推理服务将暂停约 10 分钟。这条消息未经你发送——它演示的是服务端自发起流式推送的能力。'

broadcaster.onAwake(() => {
    setTimeout(() => streamText(proactiveText), 2_000 + mock.randDelay())
})

export const subscribeChat: typeof Real.subscribeChat = handler => broadcaster.subscribe(handler)

// 类型继续透出：业务侧 import type { ChatMessage } from '@/api/chat' 在 mock 下同样可用
export type * from '../types/chat'
