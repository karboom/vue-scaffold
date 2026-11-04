import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createAppI18n, localeOptions, persistLocale, resolveInitialLocale, uiLocaleOf } from '@/i18n'
import { sessionStore } from '@/store'
import { zhCN } from '@/i18n/locales/zh-CN'
import { enUS } from '@/i18n/locales/en-US'

// 把 { a: { b: 'x' } } 拍平成 ['a.b']，用于比较两本词典的结构
const flattenKeys = (value: unknown, prefix = ''): string[] => {
    if (typeof value == 'string') {
        return [prefix]
    }
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        flattenKeys(child, prefix ? `${prefix}.${key}` : key),
    )
}

describe('i18n 词典', () => {
    it('中英文 key 结构完全一致', () => {
        expect(flattenKeys(enUS).sort()).toEqual(flattenKeys(zhCN).sort())
    })

    it('语言选项覆盖全部词典', () => {
        expect(localeOptions.map(item => item.value).sort()).toEqual(['en-US', 'zh-CN'])
    })
})

describe('i18n 实例', () => {
    it('中文插值可正常渲染', () => {
        const i18n = createAppI18n('zh-CN')

        expect(i18n.global.t('pages.index.pageOf', { page: 2, total: 57 })).toBe('第 2 页 · 共 57 条')
    })

    it('实例按传入语言初始化，切换不改词典', () => {
        const i18n = createAppI18n('en-US')

        expect(i18n.global.t('pages.login.submit')).toBe('Sign in')
        i18n.global.locale.value = 'zh-CN'
        expect(i18n.global.t('pages.login.submit')).toBe('登录')
    })

    it('未命中的 key 由 te 判定，不直接把 key 甩给用户', () => {
        const i18n = createAppI18n('en-US')

        expect(i18n.global.te('error.not-exists')).toBe(false)
        expect(i18n.global.t('common.empty')).toBe('No data')
    })

    it('两个实例语言互相独立（SSR 并发请求不串语言）', () => {
        const first = createAppI18n('zh-CN')
        const second = createAppI18n('zh-CN')

        first.global.locale.value = 'en-US'

        expect(second.global.locale.value).toBe('zh-CN')
    })
})

describe('语言真源在 store', () => {
    it('persistLocale 只落盘，resolveInitialLocale 读回落盘值', () => {
        persistLocale('en-US')

        expect(localStorage.getItem('locale')).toBe('en-US')
        expect(resolveInitialLocale()).toBe('en-US')
    })

    it('setLocale 只写 store，不越级改 i18n 实例与落盘', () => {
        setActivePinia(createPinia())
        const session = sessionStore('spec')()
        const i18n = createAppI18n('zh-CN')
        persistLocale('zh-CN')

        session.setLocale('en-US')

        expect(session.local.locale).toBe('en-US')
        // 实例是被驱动方：只有 app.vue 的 watcher 会写 i18n 与落盘
        expect(i18n.global.locale.value).toBe('zh-CN')
        expect(localStorage.getItem('locale')).toBe('zh-CN')
    })
})

describe('时间与数字格式化', () => {
    // 2026-11-05 14:23:45 +08:00
    const at = new Date('2026-11-05T06:23:45.000Z')

    // 时区钉死的意义就在这：进程时区（Node 常是 UTC）与浏览器不一致也不能改变输出，否则 SSR 与水合两个串
    it('d() 的输出与进程时区无关', () => {
        const i18n = createAppI18n('zh-CN')
        const original = process.env.TZ
        process.env.TZ = 'America/New_York'

        const text = i18n.global.d(at, 'dateTime')
        process.env.TZ = original

        expect(text).toBe(i18n.global.d(at, 'dateTime'))
        expect(text).toContain('14:23')
    })

    it('中英文各用自己的形状，指的是同一时刻', () => {
        expect(createAppI18n('zh-CN').global.d(at, 'dateTime')).toContain('2026')
        expect(createAppI18n('en-US').global.d(at, 'dateTime')).toContain('Nov')
    })

    it('n() 按语言分组计数', () => {
        expect(createAppI18n('zh-CN').global.n(1234, 'decimal')).toBe('1,234')
        expect(createAppI18n('en-US').global.n(1234, 'decimal')).toBe('1,234')
    })

    // Nuxt UI 自带文案（Drawer / Table / Toast 的 aria 与按钮）靠 UApp 注入官方词典，注入点只有一处
    it('uiLocaleOf 给每种语言配上 Nuxt UI 词典', () => {
        expect(uiLocaleOf('zh-CN').messages.drawer.close).toBe('关闭')
        expect(uiLocaleOf('en-US').messages.drawer.close).toBe('Close')
    })
})
