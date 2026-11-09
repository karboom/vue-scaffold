import { readFile } from 'node:fs/promises'
import { createUnplugin } from 'unplugin'
import { defineNuxtModule } from 'nuxt/kit'
import type { UserConfig } from 'vite'

/**
 * 页面 <route lang="yaml"> 块的桥接模块。
 * Nuxt 的页面扫描只认 definePageMeta 宏，不消费 route 块；本模块补齐三件事：
 * 1) 剔除被误扫进页面的非 .vue 文件（pages/*\/store.ts 会被当成路由）；
 * 2) pages:extend 时把 route 块的 meta/path 合并进路由记录（页面源码零改动）；
 * 3) 把 plugin-vue 为自定义块生成的 "?vue&type=route" 副作用导入 stub 成空模块。
 */

const blockRE = /<route lang="yaml">([\s\S]*?)<\/route>/
// 页面目录里的 store.ts 是状态定义，不是页面：Nuxt 的扫描会把它生成 /store 之类的野路由
// 分隔符同时认 \：Windows 下 page.file 是反斜杠绝对路径
const nonPageRE = /(^|[\/\\])store\.ts$/

type RouteBlock = { path?: string; meta?: Record<string, string | boolean> }

/**
 * 解析限定在本脚手架块形状：顶层 path + meta 两级标量（true/false/字符串）。
 * 行切分必须吃掉 \r：JS 正则里 `.` 不匹配 \r 而 `\s*` 会——Windows 检出（autocrlf）
 * 下 "meta:" 行因 \r 被 `\s*` 吞掉而命中顶层分支，带值的 "  key: value\r" 却整体失配，
 * 要么抛"无法解析"、要么静默丢 path。
 */
export const parseRouteBlock = (raw: string): RouteBlock | null => {
    const matched = blockRE.exec(raw)
    if (!matched) {
        return null
    }
    const block: RouteBlock = { meta: {} }
    const blockText = matched[1] ?? ''
    let inMeta = false
    for (const line of blockText.split(/\r\n?|\n/)) {
        if (!line.trim()) {
            continue
        }
        if (/^\S/.test(line)) {
            inMeta = false
            const top = /^(\w+):\s*(.*)$/.exec(line)
            const topKey = top?.[1]
            const topValue = top?.[2]
            if (topKey == 'path' && topValue) {
                block.path = topValue.trim()
            } else if (topKey == 'meta') {
                inMeta = true
            }
            continue
        }
        if (inMeta) {
            const prop = /^\s+(\w+):\s*(.+)$/.exec(line)
            const propName = prop?.[1]
            const propValue = prop?.[2]
            if (!propName || !propValue) {
                throw new Error(`route 块 meta 行无法解析: "${line}"`)
            }
            const rawValue = propValue.trim()
            block.meta![propName] = rawValue == 'true' ? true : rawValue == 'false' ? false : rawValue
        }
    }
    return block
}

// vite 侧：route 块的副作用导入在 Nuxt 无消费者，stub 为空模块即可
const routeBlockStub = createUnplugin(() => ({
    name: 'scaffold-route-block-stub',
    enforce: 'pre',
    load(id: string) {
        if (/[?&]vue&type=route/.test(id)) {
            return 'export default {}\n'
        }
    },
}))

/**
 * alias 前缀匹配、先命中先用；Nuxt 默认 '@'→srcDir 与用户 alias 合并后，
 * '@' 可能抢在 '@/api' 之前把 '@/api/customer' 引到 src/api/customer。重排为长键优先的数组。
 */
const reorderAlias = (config: UserConfig) => {
    const alias = config.resolve?.alias
    if (!alias || Array.isArray(alias)) {
        return
    }
    const sorted = Object.entries(alias as Record<string, string>)
        .sort(([a], [b]) => b.length - a.length)
        .map(([find, replacement]) => ({ find, replacement }))
    config.resolve!.alias = sorted
}

export default defineNuxtModule({
    meta: { name: 'scaffold-route-blocks' },
    async setup(_options, nuxt) {
        // plugins 走 options.vite（vite:extendConfig 的 config.plugins 在类型上是只读的）
        nuxt.options.vite.plugins ||= []
        nuxt.options.vite.plugins.push(routeBlockStub.vite({ moduleType: 'esm' }))

        nuxt.hooks.hook('vite:extendConfig', config => {
            reorderAlias(config)
        })

        nuxt.hooks.hook('pages:extend', async pages => {
            for (let index = pages.length - 1; index >= 0; index--) {
                const page = pages[index]!
                if (!page.file || nonPageRE.test(page.file)) {
                    pages.splice(index, 1)
                }
            }
            for (const page of pages) {
                const block = parseRouteBlock(await readFile(page.file ?? '', 'utf8'))
                if (!block) {
                    continue
                }
                page.meta = { ...page.meta, ...block.meta }
                if (block.path) {
                    page.path = block.path
                }
            }
        })
    },
})
