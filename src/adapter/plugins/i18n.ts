import { createAppI18n, resolveInitialLocale } from '@/i18n'

/**
 * vue-i18n 挂载：每请求造一个实例。
 * 语言取自 cookie / accept-language，服务端首帧与客户端水合因此同源。
 */
export default defineNuxtPlugin(nuxtApp => {
    nuxtApp.vueApp.use(createAppI18n(resolveInitialLocale()))
})
