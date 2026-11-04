import { isAxiosError } from 'axios'
import type { Pinia } from 'pinia'
import { http } from '@/api/client'
import * as log from '@/utils/log'
import { sessionStore } from '@/store'

/**
 * http 拦截接线：请求注入 Authorization；401 清 token 并跳登录。
 *
 * http 是进程级单例，而插件在每个请求都会执行——模块级 installed 保证只注册一次，
 * 否则 SSR 下 handler 数组会随请求数无上限增长。handler 内的 store 必须"调用时"取，
 * 服务端每次请求有独立 pinia，闭包捕获会把上一个请求的凭证带进来。
 */
let installed = false
let redirectingToLogin = false

export default defineNuxtPlugin(() => {
    if (installed) {
        return
    }
    installed = true

    const currentSession = () => sessionStore('app')(useNuxtApp().$pinia as Pinia)

    http.addReqHandler(config => {
        const token = currentSession().local.token
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
    })

    http.addResHandler(async error => {
        if (!isAxiosError(error) || error.response?.status != 401) {
            return
        }
        currentSession().clearToken()
        // 服务端只清凭证：SSR 期间没有可导航的客户端路由，交给渲染错误页
        if (!import.meta.client) {
            return
        }
        const router = useRouter()
        if (redirectingToLogin || router.currentRoute.value.path == '/login') {
            return
        }
        redirectingToLogin = true
        log.warn('登录已过期，跳转登录页', router.currentRoute.value.fullPath)
        try {
            await navigateTo({
                path: '/login',
                query: { redirect: router.currentRoute.value.fullPath },
            })
        } finally {
            redirectingToLogin = false
        }
    })
})
