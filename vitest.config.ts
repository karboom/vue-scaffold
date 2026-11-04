import { fileURLToPath, URL } from 'node:url'

import { loadEnv } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

/**
 * 单测配置：alias 与 Nuxt 保持一致；@/platform 显式指向 src/adapter/platform.ts，
 * 不经过 Nuxt 插件替换，直接吃里面的浏览器默认实现，因此不需要启动 Nuxt 运行时。
 */
export default defineConfig(({ mode }) => {
    // 第三参传空串 = 不做 VITE_ 前缀过滤，自定义开关变量才能读到
    const env = loadEnv(mode, process.cwd(), '')
    const useMock = env.VITE_API_MOCK == 'on'

    return {
        envDir: fileURLToPath(new URL('./', import.meta.url)),
        resolve: {
            alias: {
                // 宿主能力出口：与 nuxt.config 对齐，必须排在 '@' 之前
                '@/platform': fileURLToPath(new URL('./src/adapter/platform.ts', import.meta.url)),
                // client 与类型目录跟 real/mock 无关，必须排在 '@/api' 之前
                '@/api/client': fileURLToPath(new URL('./src/api/client.ts', import.meta.url)),
                '@/api/types': fileURLToPath(new URL('./src/api/types', import.meta.url)),
                '@/api': fileURLToPath(new URL(useMock ? './src/api/mock' : './src/api/real', import.meta.url)),
                '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
        },
        test: {
            environment: 'jsdom',
            include: ['test/unit/**/*.spec.ts'],
            exclude: [...configDefaults.exclude, 'test/e2e/**'],
        },
    }
})