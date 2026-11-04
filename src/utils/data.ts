/**
 * 唯一性诉求只是请求配对与日志追踪，不是安全场景——所以优先原生 randomUUID（零成本零依赖），
 * 无 WebCrypto 的老环境回退时间戳+随机串：熵足以避开单页面碰撞，不值得为此引 uuid 库
 */
export const createId = () =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
