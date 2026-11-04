/**
 * i18n 装配层：判定首帧语言、提供"按语言造实例"的工厂。
 * 语言真源在 sessionStore.local.locale，本文件只负责"被驱动"；
 * 词典在 ./locales/*，zh-CN 是类型源；本文件不写具体文案。
 */
import { createI18n } from 'vue-i18n'
import * as log from '@/utils/log'
import { platform } from '@/platform'
import { zhCN, type MessageSchema } from './locales/zh-CN'
import { enUS } from './locales/en-US'

// 语言偏好持久化键
const LOCALE_KEY = 'locale'

export const LOCALES = ['zh-CN', 'en-US'] as const

export type Locale = (typeof LOCALES)[number]

/**
 * 语言自称：不翻译，永远用该语言自己的写法（中文界面也显示 English）
 */
export const localeOptions: { value: Locale; label: string }[] = [
    { value: 'zh-CN', label: '中文' },
    { value: 'en-US', label: 'English' },
]

const isLocale = (value: string | null): value is Locale => (LOCALES as readonly string[]).includes(value ?? '')

/** 优先级：用户已选 > 宿主首选语言 > 中文；SSR 宿主请每请求调用，勿缓存返回值 */
export const resolveInitialLocale = (): Locale => {
    const saved = platform.storage.get(LOCALE_KEY)
    if (isLocale(saved)) {
        return saved
    }
    return platform.preferredLanguage().toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN'
}

/**
 * 词典只做 key 对齐，不给 t() 加字面量约束：
 * 路由 meta.titleKey、错误码映射都是运行期字符串，严格泛型只会逼出大量断言
 */
const messages: Record<Locale, MessageSchema> = {
    'zh-CN': zhCN,
    'en-US': enUS,
}

/**
 * 造实例而非导出单例：SSR 下模块作用域跨请求共享，单例会让 A 请求的语言串给 B。
 * 调用方是 src/adapter/plugins/i18n.ts（每请求一次）；单测也走这个工厂。
 */
export const createAppI18n = (locale: Locale) =>
    createI18n({
        legacy: false,
        locale,
        fallbackLocale: 'zh-CN',
        messages,
        missingWarn: platform.isDev,
        fallbackWarn: platform.isDev,
    })

/**
 * 语言落盘：只写存储，不碰实例。
 * 实例切换由 src/app.vue 的 locale watcher 完成（useI18n() 的 locale 是全局 composer）。
 */
export const persistLocale = (locale: Locale) => {
    // 服务端不落盘（platform.storage 在服务端是 no-op），日志也别假装写成功
    if (!platform.isClient) {
        return
    }
    log.info('语言偏好落盘', locale)
    platform.storage.set(LOCALE_KEY, locale)
}
