import { join } from 'node:path'
import { defineNuxtModule, logger } from 'nuxt/kit'
import { toMfRoutePages, type MfRouteDecl } from '../mf-manifest'

/**
 * 远程路由模块：把 nuxt.config 清单里的 mf 坐标注入路由表。
 *
 * 设计目的：
 * 1) "路由表直写远程"的机制层——每条声明生成一条指向同一本地桩（components/federation/RemotePage.vue）
 *    的路由记录，mf 坐标与静态 props 走 meta 下发，桩读取后交给 federation/Remote.vue 加载壳；
 * 2) 构建期注册是 SSR 前提——运行时 addRoute 服务端路由表不认识，ssr:true 下直闯远程路由
 *    会 404，所以清单是构建期配置（与远程入口清单的"运行期可覆盖"是两层，各司其职）；
 * 3) 无清单时整个模块零 hook 注册，路由表与纯应用一致（默认态无感，同 federation.ts）。
 *
 * 校验与组装在 src/adapter/mf-manifest.ts（纯函数，单测直打），这里只做接线。
 */
export default defineNuxtModule<{ routes?: MfRouteDecl[] }>({
    meta: { name: 'scaffold-remote-routes' },
    setup(options, nuxt) {
        const decls = options.routes ?? []
        if (decls.length == 0) {
            return
        }

        // 桩与加载壳 Remote.vue 同处 federation/ 目录，但被 nuxt.config 排除自动注册（它是路由桩不是通用组件）
        const stubFile = join(nuxt.options.srcDir, 'components/federation/RemotePage.vue')
        const pages = toMfRoutePages(stubFile, decls)
        logger.info(`远程路由已注册：${pages.map(page => `${page.path} -> ${String(page.meta.mf)}`).join(', ')}`)

        nuxt.hooks.hook('pages:extend', scanned => {
            // 与扫描页撞路径直接抛：静默覆盖页面路由是最难查的那类事故
            const taken = new Set(scanned.map(page => page.path))
            for (const page of pages) {
                if (taken.has(page.path)) {
                    throw new Error(`远程路由 ${page.path} 与本地页面路由撞路径`)
                }
                // Page 类型不再从 nuxt/schema 导出（4.6）：借 hook 参数的推断类型收编清单记录
                scanned.push(page as (typeof scanned)[number])
            }
        })
    },
})
