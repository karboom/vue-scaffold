import * as log from '@/utils/log'

/**
 * 全局异常收口：替代原 SPA 壳 main.ts 里的三处监听。
 * 浏览器全局只在客户端注册；vue:error 覆盖组件渲染/生命周期异常。
 */
export default defineNuxtPlugin(nuxtApp => {
    nuxtApp.vueApp.config.errorHandler = (error, instance, info) => {
        log.error('Vue 未捕获异常', info, error, instance?.$options.name)
    }

    nuxtApp.hook('vue:error', (error, instance, info) => {
        log.error('Vue 组件异常', info, error, instance?.$options.name)
    })

    if (!import.meta.client) {
        return
    }

    const route = useRouter().currentRoute

    window.addEventListener('unhandledrejection', event => {
        log.error('未处理的 Promise 异常', event.reason, route.value.fullPath)
    })

    window.addEventListener('error', event => {
        if (!event.error && !event.message) {
            return
        }
        log.error('全局异常', event.error ?? event.message, route.value.fullPath)
    })
})
