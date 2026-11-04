/**
 * 宿主能力契约 + 浏览器默认实现。
 *
 * 契约只有一个：核心代码（store/api/i18n/utils/pages/components）只依赖这里的类型；
 * 默认实现面向纯浏览器（单测 jsdom、未来其他壳），Nuxt 宿主在 src/adapter/plugins/platform.ts
 * 启动时用 installPlatform 替换——单测因此不需要启动 Nuxt 运行时。
 */
import * as log from '@/utils/log'

/** 键值持久层：浏览器→localStorage，Nuxt→cookie（SSR 时服务端要能读到） */
export type PlatformStorage = {
    get: (key: string) => string | null
    set: (key: string, value: string) => void
    remove: (key: string) => void
}

export type Platform = {
    storage: PlatformStorage
    /** 用户首选语言（BCP47）：浏览器→navigator.language，Nuxt SSR→请求头 accept-language */
    preferredLanguage: () => string
    /**
     * 把配置里的接口基地址解析成"本次请求可用的绝对地址"。
     * 浏览器拿到相对路径即可；SSR 侧 axios 在 Node 下必须绝对地址，否则抛 Invalid URL。
     */
    apiBase: (configured: string) => string
    /** 是否处于浏览器环境：socket、计时器等仅客户端能力的总开关 */
    readonly isClient: boolean
    /** 开发模式标记：替代 import.meta.env.DEV，屏蔽构建器差异 */
    readonly isDev: boolean
}

/** 默认实现：假设 JS 一定跑在浏览器里（单测 jsdom 同理） */
const browserPlatform: Platform = {
    storage: {
        get: key => localStorage.getItem(key),
        set: (key, value) => localStorage.setItem(key, value),
        remove: key => localStorage.removeItem(key),
    },
    preferredLanguage: () => navigator.language,
    apiBase: configured => configured,
    isClient: true,
    isDev: import.meta.env.DEV,
}

let impl: Platform = browserPlatform

/**
 * 安装宿主实现：只替换内部的 impl，platform 出口对象本身不变，
 * 调用方在模块导入期拿到的引用（如 platform.storage）因此不会失效。
 * Nuxt 侧传的是同一个对象引用，SSR 并发请求重复安装时直接返回，不会互相覆盖。
 */
export const installPlatform = (next: Platform) => {
    if (impl === next) {
        return
    }
    log.info('安装宿主能力实现', next.isClient ? 'client' : 'server')
    impl = next
}

/** 核心代码唯一的宿主能力入口：所有调用都转发给当前安装的实现 */
export const platform: Platform = {
    storage: {
        get: key => impl.storage.get(key),
        set: (key, value) => impl.storage.set(key, value),
        remove: key => impl.storage.remove(key),
    },
    preferredLanguage: () => impl.preferredLanguage(),
    apiBase: configured => impl.apiBase(configured),
    get isClient() {
        return impl.isClient
    },
    get isDev() {
        return impl.isDev
    },
}
