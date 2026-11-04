import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'

const root = fileURLToPath(new URL('./', import.meta.url))
const src = fileURLToPath(new URL('./src', import.meta.url))
// envDir 与仓库根对齐：.env / .env.development（VITE_API_MOCK/VITE_WS_URL 等）
const env = loadEnv(process.env.NODE_ENV == 'production' ? 'production' : 'development', root, '')
// 显式进程变量优先：构建机没设 NODE_ENV 时也不会误读 .env.development 把 mock 打进产物
const useMock = (process.env.VITE_API_MOCK ?? env.VITE_API_MOCK) == 'on'

/**
 * VITE_BASE_URL 支持相对路径或 CDN 绝对地址（发布脚本会传 https://cdn.example.com/<hash>/）。
 * Nuxt 把它拆成两个字段：baseURL 只吃 pathname，cdnURL 负责资源前缀。
 */
const rawBase = env.VITE_BASE_URL || '/'
const resolvedBase = new URL(rawBase, 'http://localhost')
const baseURL = resolvedBase.pathname
const cdnURL = /^https?:\/\//.test(rawBase) ? `${resolvedBase.origin}${resolvedBase.pathname}`.replace(/\/$/, '') : ''

export default defineNuxtConfig({
    /**
     * 渲染模式开关：true = 首屏 SSR + 站内 CSR，false = 纯客户端渲染。
     * 两侧所需的适配（cookie 存储、每请求 i18n、IOCtx payload 适配）都已内置，切换不需要改其他文件。
     */
    ssr: true,
    srcDir: 'src',
    // Tailwind + Nuxt UI 主题入口：没有这个文件，产物里一张 CSS 都不会生成
    css: ['~/main.css'],
    // import.meta.env.VITE_* 取仓库根的 .env
    vite: { envDir: root },
    modules: ['@nuxt/ui', '@pinia/nuxt', './src/adapter/modules/route-blocks'],

    // 页面/布局仍在 src/ 下，与 store、api 同级；宿主适配与 Nuxt 接线统一收在 src/adapter
    dir: {
        pages: 'pages',
        layouts: 'components/layouts',
        plugins: 'adapter/plugins',
        middleware: 'adapter/middleware',
    },

    // 只扫 action 子目录：Nuxt UI 注册的非自动组件入口；layouts 归 dir.layouts 专管，扫组件会撞 default 保留名
    components: [fileURLToPath(new URL('./src/components/action', import.meta.url))],

    ui: {
        // 离线构建：不走 Google Fonts 拉取，字体链路回落系统栈
        fonts: false,
    },

    // 对象键序不可靠（Nuxt 默认 '@'→srcDir 可能抢先命中 '@/api/xxx'），顺序由 adapter/modules/route-blocks 重排
    alias: {
        // 宿主能力出口：契约 + 浏览器默认实现都在 src/adapter/platform.ts，必须排在 '@' 之前
        '@/platform': fileURLToPath(new URL('./src/adapter/platform.ts', import.meta.url)),
        // client 与类型目录跟 real/mock 无关，必须排在 '@/api' 之前
        '@/api/client': fileURLToPath(new URL('./src/api/client.ts', import.meta.url)),
        '@/api/types': fileURLToPath(new URL('./src/api/types', import.meta.url)),
        // 业务代码始终 import '@/api/xxx'，指向 real 还是 mock 由开关决定
        '@/api': fileURLToPath(new URL(useMock ? './src/api/mock' : './src/api/real', import.meta.url)),
        '@': src,
    },

    

    app: {
        baseURL,
        cdnURL,
        head: {
            title: 'vue-scaffold',
        },
    },

    devServer: { port: 3173 },
})