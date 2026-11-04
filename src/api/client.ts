/**
 * 应用级客户端实例：HTTP 单例 + AI 聊天专用 socket 实例。
 * 走独立 alias '@/api/client'，不参与 '@/api' 的 real/mock 替换。
 * socket 实例在 mock 模式下仍是真实现：假象由业务域替身负责（如 mock/chat 不碰 aiSocket），
 * 懒建连保证 mock 演示全程零网络；需要第二个后端/租户实例时，用 createHttp/createSocket 单独创建，不要复用这里的配置。
 */
import { createHttp } from '@/utils/http'
import { createSocket } from '@/utils/websocket'
import { platform } from '@/platform'
import { sessionStore } from '@/store'

// baseURL 走函数：SSR 时由宿主补绝对 origin，浏览器侧原样用相对路径
export const http = createHttp({
    baseURL: () => platform.apiBase(import.meta.env.VITE_API_BASE),
})

// AI 聊天专用连接：独立 /ai 命名空间；懒建连，首帧/登录页/单测/SSR 不会触发握手
export const aiSocket = createSocket({
    url: `${import.meta.env.VITE_WS_URL}/ai`,
    // 惰性取 token：建连/重连那一刻才读，模块导入期不依赖 pinia 是否已激活
    token: () => sessionStore('app')().local.token,
    ackTimeout: 15000,
})
