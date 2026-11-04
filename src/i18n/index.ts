/**
 * i18n 装配层：判定首帧语言、提供"按语言造实例"的工厂。
 * 语言真源在 sessionStore.local.locale，本文件只负责"被驱动"；
 * 词典在 ./locales/*，zh-CN 是类型源；本文件不写具体文案。
 */
import { createI18n, type IntlDateTimeFormat, type IntlNumberFormat } from 'vue-i18n'
import { en as uiEnUS, zh_cn as uiZhCN } from '@nuxt/ui/locale'
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
 * 显示时区钉死，不跟运行环境：Node 侧常是 UTC、浏览器是用户本地，
 * 同一个时刻在 SSR 与水合两侧渲染成两个字符串就是 hydration mismatch。
 * 真要按访问者本地时区展示，前提是 platform 先把时区从客户端带到服务端，那是另一件事
 */
const DISPLAY_TIME_ZONE = 'Asia/Shanghai'

/**
 * d() 的格式档：只给"业务上真的会用的形状"，不在调用点现拼 Intl 选项，
 * 否则每页各拼一套，切语言时也没法统一调整
 */
const datetimeFormats: Record<Locale, IntlDateTimeFormat> = {
    'zh-CN': {
        date: { dateStyle: 'short', timeZone: DISPLAY_TIME_ZONE },
        dateTime: { dateStyle: 'short', timeStyle: 'short', hour12: false, timeZone: DISPLAY_TIME_ZONE },
    },
    'en-US': {
        date: { dateStyle: 'medium', timeZone: DISPLAY_TIME_ZONE },
        dateTime: { dateStyle: 'medium', timeStyle: 'short', timeZone: DISPLAY_TIME_ZONE },
    },
}

/** n() 的格式档：整数计数走 decimal，金额出现后再启用 currency */
const numberFormats: Record<Locale, IntlNumberFormat> = {
    'zh-CN': {
        decimal: { style: 'decimal', maximumFractionDigits: 0 },
        currency: { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 },
    },
    'en-US': {
        decimal: { style: 'decimal', maximumFractionDigits: 0 },
        currency: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 },
    },
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
        datetimeFormats,
        numberFormats,
        missingWarn: platform.isDev,
        fallbackWarn: platform.isDev,
    })

/**
 * Nuxt UI 组件自带文案（Table 空态、Select / Drawer / Toast 的 aria 与按钮）的词典。
 * 官方词典从 @nuxt/ui/locale 出，形状与我们自己的 messages 无关，只按 Locale 键对齐；
 * 出口给 app.vue 挂到 UApp，组件内部用 useLocale() 读同一份，所以注入点仍然只有一个
 */
const uiLocales = { 'zh-CN': uiZhCN, 'en-US': uiEnUS }

export const uiLocaleOf = (locale: Locale) => uiLocales[locale]

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
