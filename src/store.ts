/**
 * 全局状态
 * 用法：sessionStore(id)()
 */
import { defineStore } from 'pinia'
import * as log from '@/utils/log'
import { platform } from '@/platform'
import { resolveInitialLocale, type Locale } from '@/i18n'

// token 持久化键：刷新后由 state 初始化回填
const TOKEN_KEY = 'token'

export type LocalState = {
    token: string
    /** 界面语言真源：写入只认这里，i18n 实例与 DOM 由 src/app.vue 的 watcher 被动跟随 */
    locale: Locale
}

export type RemoteState = Record<string, never>

export type SessionState = {
    local: LocalState
    remote: RemoteState
}

export const sessionStore = (id: string) =>
    defineStore(`session_${id}`, {
        state: (): SessionState => ({
            local: {
                token: platform.storage.get(TOKEN_KEY) ?? '',
                // 每次实例化现取：SSR 宿主里模块常量会跨请求共享，必须走函数
                locale: resolveInitialLocale(),
            },
            remote: {},
        }),
        actions: {
            setToken(token: string) {
                log.info('写入登录凭证', token)
                this.local.token = token
                platform.storage.set(TOKEN_KEY, token)
            },
            clearToken() {
                log.info('清空登录凭证')
                this.local.token = ''
                platform.storage.remove(TOKEN_KEY)
            },
            setLocale(locale: Locale) {
                log.info('更新界面语言', locale)
                this.local.locale = locale
            },
        },
    })
