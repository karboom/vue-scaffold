/**
 * 远程路由清单的纯逻辑：声明校验 + 本地桩路由组装。
 *
 * 设计目的：
 * 1) 与 nuxt/kit 解耦——构建期模块与单测共用同一份判定逻辑，jsdom 里不需要 Nuxt 运行时；
 * 2) 路由表物理上只能指向本地模块（构建期扫描、SSR 路由记录、路由宏都在宿主侧），
 *    所以"直写远程"的形态 = 清单声明 mf 坐标 + 全部远程路由共享一个本地桩
 *    （components/federation/RemotePage.vue，与加载壳 Remote.vue 同目录）。
 * 这里负责把声明翻译成 pages:extend 可注入的 Page 记录。
 */

export type MfRouteDecl = {
    /** 宿主路由路径（Nuxt 路由语法，支持参数段） */
    path: string
    /** 远程坐标：`容器名/模块`，与 NUXT_PUBLIC_MF_HOSTS 的 name 及 expose 清单对齐 */
    mf: string
    /** 静态 props：随路由记录序列化，必须是可 devalue 的纯 JSON（禁函数/类实例） */
    props?: Record<string, unknown>
    /** 页面 meta（titleKey / requiresAuth 等），语义与 <route> 块一致 */
    meta?: Record<string, string | boolean>
}

export type MfRoutePage = {
    name: string
    path: string
    file: string
    children: []
    meta: Record<string, unknown>
}

/** 路由名：mf_ 前缀 + 路径符号归一，保证与扫描页的 name 不撞 */
const toRouteName = (path: string): string => `mf_${path.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`

/**
 * 校验并组装。抛错口径：配置错误在构建期就该炸，不留到运行时的"未配置"空态——
 * 后者只兜运行期缺清单，不兜清单写错。
 */
export const toMfRoutePages = (stubFile: string, decls: MfRouteDecl[]): MfRoutePage[] => {
    const seen = new Set<string>()
    return decls.map(decl => {
        if (decl.path == null || decl.path == '') {
            throw new Error(`远程路由缺 path：${JSON.stringify(decl)}`)
        }
        if (decl.mf == null || !decl.mf.includes('/')) {
            throw new Error(`远程路由的 mf 应为 容器名/模块：${decl.mf ?? ''}（${decl.path}）`)
        }
        if (seen.has(decl.path)) {
            throw new Error(`远程路由清单里 ${decl.path} 重复`)
        }
        seen.add(decl.path)
        return {
            name: toRouteName(decl.path),
            path: decl.path,
            file: stubFile,
            children: [],
            meta: {
                ...decl.meta,
                mf: decl.mf,
                mfProps: decl.props ?? {},
            },
        }
    })
}
