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
        /** 联邦身份开关：provider = 作为远程组件提供方（构建期消费，与 VITE_API_MOCK 同类） */
        readonly VITE_MF: string
        /** 联邦宿主清单：`name@entryUrl` 逗号分隔；构建期缺省值，运行期由 NUXT_PUBLIC_MF_HOSTS 覆盖 */
        readonly VITE_MF_HOSTS: string
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
        /** 远程页面坐标（容器名/模块）：remote-routes 清单注入，普通路由不写 */
        mf?: string
        /** 远程页面静态 props：桩原样 v-bind，禁函数/类实例（要走 SSR 序列化） */
        mfProps?: Record<string, unknown>
    }
}
