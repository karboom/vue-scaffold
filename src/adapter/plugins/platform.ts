import { installPlatform, type Platform } from '@/platform'

/**
 * Nuxt 宿主实现（契约与浏览器默认实现在 src/adapter/platform.ts）。
 *
 * 为什么放在插件里而不是模块顶层：useCookie / useRequestHeaders / useRequestURL 是 Nuxt 自动导入，
 * 只在 Nuxt 构建产物里被注入，且必须在请求上下文内调用；模块顶层求值会让单测（jsdom、不启动 Nuxt）
 * 直接踩空。
 *
 * storage 用 cookie 而非 localStorage：SSR 时服务端必须能读到 token / locale，
 * 浏览器侧 useCookie 同样读写 document.cookie，因此 ssr:false 下行为等价。
 * enforce: 'pre' —— i18n 插件在 setup 里就要解析首帧语言（storage.get / preferredLanguage），
 * 本插件必须排在它之前。
 */
const nuxtPlatform: Platform = {
    storage: {
        get: key => useCookie(key).value ?? null,
        set: (key, value) => {
            // 服务端写 cookie 只会多吐一个 Set-Cookie；落盘只由用户动作触发，必然发生在客户端
            if (import.meta.server) {
                return
            }
            useCookie(key).value = value
        },
        remove: key => {
            if (import.meta.server) {
                return
            }
            useCookie(key).value = null
        },
    },
    preferredLanguage: () =>
        import.meta.server
            ? (useRequestHeaders(['accept-language'])['accept-language']?.split(',')[0]?.trim() ?? 'zh-CN')
            : navigator.language,
    // 服务端 axios 需要绝对地址：相对路径在这里补上当前请求的 origin
    apiBase: configured =>
        import.meta.server && configured.startsWith('/')
            ? new URL(configured, useRequestURL().origin).toString()
            : configured,
    isClient: import.meta.client,
    isDev: import.meta.dev,
}

export default defineNuxtPlugin({
    name: 'platform',
    enforce: 'pre',
    setup() {
        installPlatform(nuxtPlatform)
    },
})
