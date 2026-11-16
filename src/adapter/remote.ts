/**
 * 联邦宿主加载器：把 @module-federation/runtime 的远程模块变成可用的 Vue 组件。
 *
 * 设计目的：
 * 1) 纯客户端边界——本文件只在浏览器被真正调用（Remote.vue 包在 <ClientOnly> 里），
 *    SSR 阶段远程入口永不解析，远程宕机 / CDN 抖动都不会拖垮宿主首屏；
 * 2) vue/pinia 以 singleton 导出宿主 bundle 里的实例——红线：远程必须复用宿主的 Vue，
 *    双实例会导致响应式与注入静默失效（排查成本极高）；两项目同源 lockfile 保证版本握手；
 * 3) 入口清单是运行期配置（runtimeConfig.public.mfHosts），远程换版本不触发宿主重建；
 * 4) 加载结果按 path 缓存：同一远程组件多处消费只拉一次 remoteEntry。
 */
import { init, loadRemote } from '@module-federation/runtime'
import * as vue from 'vue'
import * as pinia from 'pinia'
import type { Component } from 'vue'
import * as log from '@/utils/log'

export type MfHost = {
    name: string
    entry: string
}

/**
 * 解析 `name@entryUrl,name2@entryUrl2` 形态的宿主清单。
 * 空串 = 未启用联邦（合法状态，不是错误）；条目缺 '@' 视为配置错误直接抛。
 */
export const parseMfHosts = (raw: string): MfHost[] => {
    if (raw == '') {
        return []
    }
    return raw.split(',').map(item => {
        const index = item.indexOf('@')
        if (index <= 0) {
            throw new Error(`非法的联邦宿主配置：${item}（应为 name@entryUrl）`)
        }
        return { name: item.slice(0, index).trim(), entry: item.slice(index + 1).trim() }
    })
}

let installed = false

/** 幂等初始化：多个 Remote 实例并发挂载也只 init 一次 runtime */
const ensureRuntime = (hosts: MfHost[]) => {
    if (installed) {
        return
    }
    installed = true
    log.info('初始化联邦宿主 runtime', hosts.map(host => `${host.name} -> ${host.entry}`).join(','))
    init({
        name: 'scaffold_host',
        // type:'module' 是给 vite 系 provider 的：runtime 默认把 remoteEntry 当经典 <script> 注入，
        // 而 @module-federation/vite 的产物是 ESM，不做 script 解析（SyntaxError: Cannot use import...）
        remotes: hosts.map(host => ({ ...host, type: 'module' })),
        shared: {
            // lib 返回宿主 bundle 自己的模块实例：远程构建里 vue/pinia 是 externals，
            // 运行时只会从共享作用域取到这一份
            vue: {
                version: vue.version,
                lib: () => vue,
                shareConfig: { singleton: true, requiredVersion: false },
            },
            // pinia 不导出 version（公开 API 没有它）：version 在共享协议里是可选记录项，
            // singleton + requiredVersion:false 才是约束本体
            pinia: {
                lib: () => pinia,
                shareConfig: { singleton: true, requiredVersion: false },
            },
        },
    })
}

/**
 * 远程模块 → Vue 组件的归一化。
 * @module-federation/vite 构建的远程，get() 返回的是"工厂函数"（要再 await 一次
 * 才拿到 { default: 组件 } 的模块命名空间）；不同 runtime 版本可能直接透传命名空间。
 * 这不是防御性的存在判断，而是两种协议形态的适配，故两种都要认。
 */
export const normalizeRemoteModule = async (mod: unknown): Promise<Component> => {
    const resolved = typeof mod == 'function' ? await (mod as () => Promise<unknown>)() : mod
    const namespace = resolved as { default?: Component }
    return namespace.default ?? (resolved as Component)
}

const cache = new Map<string, Promise<Component>>()

/**
 * 取远程组件：promise 级缓存——同一 path 多处消费只拉一次 remoteEntry；
 * 失败不留在缓存里（重试要能重新拉），错误原样抛出，状态归调用方的壳管。
 * 幂等 init + 拉取 + 归一化全在这条链上，宿主组件侧不需要知道 runtime 存在。
 */
export const fetchRemoteComponent = async (path: string, hosts: MfHost[]): Promise<Component> => {
    const cached = cache.get(path)
    if (cached) {
        return cached
    }
    log.info('加载联邦远程组件', path)
    const task = (async () => {
        ensureRuntime(hosts)
        const mod = await loadRemote(path)
        return normalizeRemoteModule(mod)
    })()
    task.catch(() => cache.delete(path))
    cache.set(path, task)
    return task
}

/** 测试之间复位模块级状态：缓存 + 已安装标记（浏览器运行期永不重置——runtime 只装一次是刻意的） */
export const resetRemoteState = () => {
    cache.clear()
    installed = false
}
