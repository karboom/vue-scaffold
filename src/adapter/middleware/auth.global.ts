import { sessionStore } from '@/store'
import * as log from '@/utils/log'

// 受保护页未登录时跳登录并带 redirect
export default defineNuxtRouteMiddleware(to => {
    const session = sessionStore('app')()
    const needLogin = to.meta.requiresAuth && !session.local.token
    log.info('路由前置守卫', to.fullPath, String(needLogin))
    if (needLogin) {
        return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
    }
})
