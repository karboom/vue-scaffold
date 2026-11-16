import { describe, expect, it } from 'vitest'
import { toMfRoutePages } from '@/adapter/mf-manifest'

describe('远程路由清单：toMfRoutePages', () => {
    const stub = '/abs/src/components/federation/RemotePage.vue'

    it('基本组装：桩文件、name 前缀、mf/mfProps 落进 meta', () => {
        const [page] = toMfRoutePages(stub, [{ path: '/remote-about', mf: 'crm/AboutCard' }])

        expect(page).toEqual({
            name: 'mf_remote_about',
            path: '/remote-about',
            file: stub,
            children: [],
            meta: { mf: 'crm/AboutCard', mfProps: {} },
        })
    })

    it('meta 透传 titleKey/requiresAuth，props 落进 mfProps', () => {
        const [page] = toMfRoutePages(stub, [
            { path: '/x', mf: 'crm/W', meta: { titleKey: 't', requiresAuth: true }, props: { a: 1 } },
        ])

        expect(page.meta).toEqual({ titleKey: 't', requiresAuth: true, mf: 'crm/W', mfProps: { a: 1 } })
    })

    it('mf 缺容器名（无斜杠）视为配置错误，构建期直接抛', () => {
        expect(() => toMfRoutePages(stub, [{ path: '/x', mf: 'AboutCard' }])).toThrowError(/容器名\/模块/)
    })

    it('缺 path 抛', () => {
        expect(() => toMfRoutePages(stub, [{ path: '', mf: 'crm/W' }])).toThrowError(/缺 path/)
    })

    it('清单内重复 path 抛（静默覆盖是最难查的事故）', () => {
        expect(() =>
            toMfRoutePages(stub, [
                { path: '/dup', mf: 'crm/A' },
                { path: '/dup', mf: 'crm/B' },
            ]),
        ).toThrowError(/重复/)
    })

    it('多条共享同一桩，name 各自归一不撞', () => {
        const pages = toMfRoutePages(stub, [
            { path: '/crm/list', mf: 'crm/List' },
            { path: '/crm/detail', mf: 'crm/Detail' },
        ])

        expect(pages.every(page => page.file == stub)).toBe(true)
        expect(pages.map(page => page.name)).toEqual(['mf_crm_list', 'mf_crm_detail'])
    })
})
