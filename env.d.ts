/// <reference types="vite/client" />

import 'vue-router'

declare global {
    interface ImportMetaEnv {
        readonly VITE_BASE_URL: string
        readonly VITE_API_BASE: string
        readonly VITE_API_MOCK: string
        readonly VITE_WS_URL: string
        /** error 日志上报地址（相对 VITE_API_BASE 的路径或绝对地址）：留空即不启用上报 */
        readonly VITE_LOG_REPORT_URL: string
    }

    interface ImportMeta {
        readonly env: ImportMetaEnv
    }
}

// 页面 <route> 块的 meta 声明；约定属性必存在，守卫内不做存在性判断
// titleKey 是 i18n 词典的 key（不是译文），切语言时标题才会重新翻译
declare module 'vue-router' {
    interface RouteMeta {
        titleKey: string
        requiresAuth: boolean
    }
}