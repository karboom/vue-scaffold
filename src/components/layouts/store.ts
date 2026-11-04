import { defineStore } from 'pinia'
import { IOCtx } from '@/utils/io'
import * as log from '@/utils/log'
import { sessionStore } from '@/store'
import { fetchProfile, type ProfileItem } from '@/api/profile'

/**
 * 布局（左侧边栏，2 级菜单，结构依据 prd/total.md）状态
 * 用法：layoutStore(id)()
 *
 * 折叠/展开/路由高亮已由 UDashboardSidebar + UNavigationMenu 内置接管，
 * 这里只保留菜单数据与业务状态。
 */

// 二级叶子：可点击跳转的菜单项
// labelKey 存 i18n key 而不是译文：切语言时 store 不重算，渲染处 t() 才会跟着变
export type MenuItem = {
    key: string
    labelKey: string
    icon: string
    path: string
}

// 一级分组：仅用于展开/收起（无二级项的分组配同名二级项）
export type MenuGroup = {
    key: string
    labelKey: string
    icon: string
    children: MenuItem[]
}

export type LocalState = {
    menuTree: MenuGroup[]
    unreadCount: number
}

export type RemoteState = {
    profileIo: IOCtx<ProfileItem | null>
}

export type LayoutState = {
    local: LocalState
    remote: RemoteState
}

// 叶子菜单（key -> 菜单项）
const menuMap = new Map<string, MenuItem>([
    ['demo', { key: 'demo', labelKey: 'layout.menu.demo', icon: 'gauge', path: '/' }],
    ['chat', { key: 'chat', labelKey: 'layout.menu.chat', icon: 'bot', path: '/chat' }],
])

// 2 级菜单树：脚手架演示
const menuGroups: MenuGroup[] = [
    {
        key: 'demo-group',
        labelKey: 'layout.menu.scaffold',
        icon: 'gauge',
        children: [menuMap.get('demo')!, menuMap.get('chat')!],
    },
]

export const layoutStore = (id: string) =>
    defineStore(`layout_${id}`, {
        state: (): LayoutState => ({
            local: {
                menuTree: menuGroups,
                unreadCount: 5,
            },
            remote: {
                profileIo: new IOCtx<ProfileItem | null>(null),
            },
        }),
        actions: {
            clearNotifications() {
                log.info('清空未读通知', this.local.unreadCount)
                this.local.unreadCount = 0
            },
            logout() {
                log.info('用户退出登录', this.remote.profileIo.data)
                this.remote.profileIo.data = null
                sessionStore('app')().clearToken()
            },
            async loadProfile() {
                log.info('加载用户资料')
                const io = this.remote.profileIo
                await io.run(ctx => fetchProfile(ctx))
            },
        },
    })
