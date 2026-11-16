import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineNuxtModule, logger } from 'nuxt/kit'
import type { Plugin } from 'vite'
import { federation } from '@module-federation/vite'

/**
 * 联邦提供者模块：VITE_MF=provider 时把本项目变成远程组件的提供方。
 *
 * 设计目的：
 * 1) "约定即配置"——exposes 清单由 src/federation/*.vue 扫描生成，新增组件不碰配置文件；
 * 2) 只在客户端构建注入 federation 插件——远程组件的渲染发生在【宿主的浏览器】里
 *    （宿主侧一律 <ClientOnly> 边界），本项目的 SSR/Nitro 产物不认识联邦，
 *    因此服务端 payload 序列化、每请求 i18n、platform 契约三大 SSR 适配零冲突；
 * 3) 开关关闭时整个模块不注册任何 hook，构建产物与现状逐字节一致
 *    （与 VITE_API_MOCK 的 real/mock 开关同一"默认态无感"承诺）。
 *
 * shared 红线：vue/pinia 以 singleton 共享，宿主与提供者必须同源升级
 * （两个项目共用这份脚手架的 package.json + lockfile，版本对齐是结构性的而非靠人）。
 */
export default defineNuxtModule<{ provider?: boolean }>({
    meta: { name: 'scaffold-federation' },
    setup(options, nuxt) {
        if (!options.provider) {
            return
        }

        const federationDir = join(nuxt.options.srcDir, 'federation')
        const exposes = scanExposes(federationDir)
        // 构建期模块跑在 jiti 里，用不了应用侧 @/utils/log，日志走 nuxt/kit logger
        logger.info(`联邦提供者模式已启用：expose ${Object.keys(exposes).length} 个组件`, Object.keys(exposes))
        // Nuxt 4.6 的 options 上不挂 packageJson / name，容器名直接读根 package.json
        const pkg = JSON.parse(readFileSync(join(nuxt.options.rootDir, 'package.json'), 'utf8')) as {
            name?: string
        }
        const appName = pkg.name ?? 'scaffold'

        nuxt.hooks.hook('vite:extendConfig', (config, { isServer }) => {
            // 服务端构建保持原样：联邦是纯客户端边界
            if (isServer) {
                return
            }
            // config.plugins 在类型上是只读（与 route-blocks 同款问题），运行时数组可原地 push
            ;(config.plugins as Plugin[]) ||= []
            ;(config.plugins as Plugin[]).push(
                ...federation({
                    name: appName.replace(/-/g, '_'),
                    filename: '_nuxt/remoteEntry.js',
                    // dts 插件按根 tsconfig 路径找 src/tsconfig.json 会炸（Nuxt 的类型在 .nuxt/ 下），
                    // POC 先关类型生成，类型契约走 contracts 包另议
                    dts: false,
                    exposes,
                    shared: {
                        vue: { singleton: true },
                        pinia: { singleton: true },
                    },
                }),
            )
        })
    },
})

/** 扫描约定目录生成 exposes 映射：文件名即远程模块名（'./HelloWidget' → 'crm/HelloWidget'） */
const scanExposes = (dir: string): Record<string, string> => {
    const exposes: Record<string, string> = {}
    for (const file of readdirSync(dir)) {
        if (file.endsWith('.vue')) {
            exposes[`./${file.slice(0, -'.vue'.length)}`] = join(dir, file)
        }
    }
    if (Object.keys(exposes).length == 0) {
        throw new Error(`联邦提供者模式已开启，但 ${dir} 下没有可 expose 的组件`)
    }
    return exposes
}
