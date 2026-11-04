import { test as base, expect, type Page, type WebSocketRoute } from '@playwright/test'

/**
 * e2e 共享夹具：替代原 Cypress 的 cy.intercept / onBeforeLoad 样板。
 * 生产构建默认 mock=off，接口一律由 page.route 代答；用例只描述差异数据。
 */

const profileJson = { id: 'u_1', name: '演示用户', email: 'demo@example.com', avatar: '' }
const customersEmpty = { list: [], total: 0, page: 1, pageSize: 10 }
// 详情/更新共用一条 URL 前缀：GET 回详情，PUT 把请求体并进详情回给页面
const customerDetailJson = {
    id: 'c_1',
    name: '张三',
    company: '示例公司',
    level: 'vip',
    phone: '13800000000',
    sessions: 12,
    tickets: 3,
    lastActive: '2026-01-01 10:00:00',
    tags: ['重点客户'],
    remark: '演示备注',
}
const loginBaseUser = { id: 'u_1', name: '演示用户', avatar: '' }

// —— AI 聊天 socket 桩协议片段 ——
// Engine.IO v4：'0' 握手帧、'2'/'3' ping/pong、'4'+Socket.IO 包。
// Socket.IO 包：类型 0=命名空间连接（'40/user/ai{...}'），2=事件（'42/user/ai,[...]'）；
// io('/user/ai') 的 pathname 是【命名空间】，线上请求 path 恒为 /socket.io/
const AI_NS = '/user/ai'
const engineOpenFrame = '0{"sid":"pw_eio","upgrades":[],"pingInterval":25000,"pingTimeout":20000}'
// 命名空间与负载之间必须带逗号分隔（socket.io-parser：<type><nsp>,<id?><json?>）
const nsOpenFrame = `40${AI_NS},{"sid":"pw_sio"}`

/** 组命名空间事件帧：负载双重 JSON（业务 JSON 字符串再包事件数组），与真后端逐字节同构 */
const sioEventFrame = (event: string, envelope: unknown): string =>
    `42${AI_NS},${JSON.stringify([event, JSON.stringify(envelope)])}`

const chatSeedMessages = [
    { id: 'h_1', role: 'assistant', content: '你好，这是 e2e 桩里的助手。', streaming: false, createdAt: 0 },
    { id: 'h_2', role: 'user', content: '介绍一下你自己。', streaming: false, createdAt: 0 },
]

const chatReplyFor = (text: string): string =>
    `收到${text}，这是真实 socket 链路的 e2e 罐头回复，协议与 mock 替身完全一致。`

// 主动推送剧本：命名空间握手后 1.5s，"服务端"不经任何发送自己推一条
const chatProactiveText = '【主动推送】今晚 23:00 定时维护，推理服务将暂停约 10 分钟。'

/** 每 20ms 流 4 字，末段后补 done：节奏确定，用例以 poll 等待收口 */
const streamChatReply = (ws: WebSocketRoute, reply: string) => {
    const messageId = `ai_${Date.now()}`
    ws.send(sioEventFrame('chat', { msgId: 'push', body: { type: 'start', messageId } }))
    let elapsed = 50
    for (let index = 0; index < reply.length; index += 4) {
        elapsed += 20
        const delta = reply.slice(index, index + 4)
        setTimeout(
            () => ws.send(sioEventFrame('chat', { msgId: 'push', body: { type: 'delta', messageId, delta } })),
            elapsed,
        )
    }
    setTimeout(() => ws.send(sioEventFrame('chat', { msgId: 'push', body: { type: 'done', messageId } })), elapsed + 20)
}

type SeedOptions = {
    token?: string
    locale?: string
}

type MockApi = {
    profile: () => Promise<void>
    customers: (body?: { list: unknown[]; total: number; page: number; pageSize: number }) => Promise<void>
    /** 详情 + 更新桩：与列表同前缀，靠"后注册的 route 优先命中"覆盖 /api/v1/customers/:id */
    customerDetail: (body?: Record<string, unknown>) => Promise<void>
    /** 短信码 + 登录桩：token 里回显 method，便于断言走的哪条登录链路 */
    auth: () => Promise<void>
    /** /ai 命名空间桩：Engine.IO v4 + Socket.IO 握手代答，信封协议（msgId 配对 + 流式推送） */
    aiSocket: () => Promise<void>
}

type AppFixtures = {
    /** 首次导航前写入 cookie（宿主 storage 落在 cookie，SSR 时服务端也要读得到）；默认钉住中文语言 */
    seed: (options?: SeedOptions) => Promise<void>
    mockApi: MockApi
}

/** 读取 cookie 值：token / locale 由 platform.storage 落在 cookie */
export const cookieValue = async (page: Page, name: string) =>
    page.evaluate(key => {
        const matched = document.cookie.split('; ').find(item => item.startsWith(`${key}=`))
        return matched ? decodeURIComponent(matched.slice(key.length + 1)) : null
    }, name)

export const test = base.extend<AppFixtures>({
    seed: async ({ context, baseURL }, use) => {
        await use(async (options = {}) => {
            const wanted: { name: string; value: string }[] = [{ name: 'locale', value: options.locale ?? 'zh-CN' }]
            if (options.token !== undefined) {
                wanted.push({ name: 'token', value: options.token })
            }
            // 只在键缺失时写入：seed 是"初始值"不是"强制值"，
            // 否则 reload 后会把用户运行中写入的偏好（如 locale）盖回去
            const existing = new Set((await context.cookies(baseURL)).map(cookie => cookie.name))
            await context.addCookies(
                wanted.filter(cookie => !existing.has(cookie.name)).map(cookie => ({ ...cookie, url: baseURL! })),
            )
        })
    },
    mockApi: async ({ page }, use) => {
        await use({
            profile: async () => {
                await page.route('**/api/profile', route => route.fulfill({ json: profileJson }))
            },
            customers: async (body = customersEmpty) => {
                await page.route('**/api/v1/customers*', route => route.fulfill({ json: body }))
            },
            customerDetail: async (body = customerDetailJson) => {
                await page.route('**/api/v1/customers/*', route => {
                    const request = route.request()
                    if (request.method() == 'PUT') {
                        route.fulfill({ json: { ...body, ...request.postDataJSON() } })
                        return
                    }
                    route.fulfill({ json: body })
                })
            },
            auth: async () => {
                await page.route('**/api/v1/auth/sms-code', route => route.fulfill({ json: { expireSeconds: 60 } }))
                await page.route('**/api/v1/auth/login', route => {
                    const method = route.request().postDataJSON().method
                    route.fulfill({ json: { token: `tk_${method}`, user: loginBaseUser } })
                })
            },
            aiSocket: async () => {
                // socket.io 请求 path 恒为 /socket.io/，命名空间在帧头里判别，不连上游
                await page.routeWebSocket(
                    url => url.pathname == '/socket.io/',
                    ws => {
                        ws.send(engineOpenFrame)
                        // 1.64 起 onMessage 回调直接收 payload（string|Buffer），不是 message 对象
                        ws.onMessage(message => {
                            const frame = typeof message == 'string' ? message : message.toString('utf8')
                            if (frame == '2') {
                                ws.send('3')
                                return
                            }
                            if (!frame.startsWith('4')) {
                                return
                            }
                            // 去掉 Engine.IO message 头 '4'，再看 Socket.IO 包类型
                            const sio = frame.slice(1)
                            const type = sio[0]
                            const rest = sio.slice(1)
                            if (type == '0') {
                                // 命名空间连接：只服务 /user/ai，其余放行不管
                                if (rest.startsWith(AI_NS)) {
                                    ws.send(nsOpenFrame)
                                    // 握手成功即上膛主动推送，与 mock 域替身同一剧本
                                    setTimeout(() => streamChatReply(ws, chatProactiveText), 1_500)
                                }
                                return
                            }
                            if (type != '2' || !rest.startsWith(`${AI_NS},`)) {
                                return
                            }
                            const [event, payload] = JSON.parse(rest.slice(AI_NS.length + 1)) as [string, string]
                            const envelope = JSON.parse(payload) as {
                                msgId: string
                                body: { action: string; text?: string }
                            }
                            if (event == 'chat_history') {
                                ws.send(
                                    sioEventFrame(event, {
                                        msgId: envelope.msgId,
                                        body: { messages: chatSeedMessages },
                                    }),
                                )
                                return
                            }
                            if (event == 'chat' && envelope.body.action == 'send') {
                                streamChatReply(ws, chatReplyFor(envelope.body.text!))
                            }
                        })
                    },
                )
            },
        })
    },
})

export { expect, type Page }
