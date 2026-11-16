import { beforeEach, describe, expect, it, vi } from 'vitest'

// MF runtime 替身：单测不拉真 remoteEntry，只验证清单解析、协议形态归一与缓存纪律
vi.mock('@module-federation/runtime', () => ({
    init: vi.fn(),
    loadRemote: vi.fn(),
}))

import { init, loadRemote } from '@module-federation/runtime'
import { parseMfHosts, normalizeRemoteModule, fetchRemoteComponent, resetRemoteState } from '@/adapter/remote'

describe('联邦宿主加载器', () => {
    beforeEach(() => {
        resetRemoteState()
        vi.clearAllMocks()
    })

    describe('parseMfHosts：清单解析', () => {
        it('空串 = 未启用联邦，返回空清单而不是报错', () => {
            expect(parseMfHosts('')).toEqual([])
        })

        it('name@entryUrl 逗号分隔逐项解析', () => {
            const hosts = parseMfHosts(
                'crm@https://cdn.example.com/crm/remoteEntry.js,bi@https://cdn.example.com/bi/remoteEntry.js',
            )

            expect(hosts).toEqual([
                { name: 'crm', entry: 'https://cdn.example.com/crm/remoteEntry.js' },
                { name: 'bi', entry: 'https://cdn.example.com/bi/remoteEntry.js' },
            ])
        })

        it('缺 @ 或 @ 在开头的条目视为配置错误，直接抛', () => {
            expect(() => parseMfHosts('https://cdn.example.com/crm/remoteEntry.js')).toThrowError(/非法的联邦宿主配置/)
            expect(() => parseMfHosts('@https://cdn.example.com/crm/remoteEntry.js')).toThrowError(/非法的联邦宿主配置/)
        })
    })

    describe('normalizeRemoteModule：远程模块 → 组件', () => {
        const component = { name: 'HelloWidget' }

        it('vite 远程的 factory 形态：先调用再取 default', async () => {
            const factory = vi.fn(async () => ({ default: component }))

            await expect(normalizeRemoteModule(factory)).resolves.toBe(component)
            expect(factory).toHaveBeenCalledTimes(1)
        })

        it('标准模块命名空间形态：直接透传', async () => {
            await expect(normalizeRemoteModule({ default: component })).resolves.toBe(component)
        })

        it('无 default 导出的命名空间：整体即组件', async () => {
            await expect(normalizeRemoteModule(component)).resolves.toBe(component)
        })
    })

    describe('fetchRemoteComponent：init 幂等与缓存', () => {
        const hosts = [{ name: 'crm', entry: 'https://cdn.example.com/crm/remoteEntry.js' }]

        it('首次加载完成 init + loadRemote 全链路，返回归一化组件', async () => {
            vi.mocked(loadRemote).mockResolvedValue(async () => ({ default: { name: 'HelloWidget' } }))

            const comp = await fetchRemoteComponent('crm/HelloWidget', hosts)

            expect(init).toHaveBeenCalledTimes(1)
            expect(loadRemote).toHaveBeenCalledWith('crm/HelloWidget')
            expect(comp).toEqual({ name: 'HelloWidget' })
        })

        it('同一 path 多处消费只拉一次', async () => {
            vi.mocked(loadRemote).mockResolvedValue(async () => ({ default: { name: 'HelloWidget' } }))

            const [first, second] = await Promise.all([
                fetchRemoteComponent('crm/HelloWidget', hosts),
                fetchRemoteComponent('crm/HelloWidget', hosts),
            ])

            expect(loadRemote).toHaveBeenCalledTimes(1)
            expect(first).toBe(second)
        })

        it('失败不留在缓存：重试会重新拉取', async () => {
            vi.mocked(loadRemote).mockRejectedValueOnce(new Error('remote 502'))
            await expect(fetchRemoteComponent('crm/HelloWidget', hosts)).rejects.toThrowError('remote 502')
            // 等 cache.delete 的 microtask 落地
            await Promise.resolve()

            vi.mocked(loadRemote).mockResolvedValue(async () => ({ default: { name: 'HelloWidget' } }))
            const retry = await fetchRemoteComponent('crm/HelloWidget', hosts)

            expect(retry).toEqual({ name: 'HelloWidget' })
            expect(loadRemote).toHaveBeenCalledTimes(2)
        })

        it('runtime 只 init 一次：跨 path 也不重复安装', async () => {
            vi.mocked(loadRemote).mockResolvedValue(async () => ({ default: { name: 'A' } }))

            await fetchRemoteComponent('crm/HelloWidget', hosts)
            await fetchRemoteComponent('crm/OtherWidget', hosts)

            expect(init).toHaveBeenCalledTimes(1)
        })
    })
})
