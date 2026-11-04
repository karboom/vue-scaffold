import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// 首页演示的是「详情 + 更新」两条链路，单测只验编排：api 一律替身，真实契约由 typecheck 与 e2e 保证
vi.mock('@/api/customer', () => ({
    fetchCustomerList: vi.fn(async (_io: unknown, params: { page: number }) => ({
        list: [
            {
                id: 'c_1',
                name: '客户一',
                company: '公司',
                level: 'vip',
                phone: '13800000000',
                sessions: 1,
                tickets: 0,
                lastActive: 'now',
            },
        ],
        total: 1,
        page: params.page,
        pageSize: 10,
    })),
    fetchCustomerDetail: vi.fn(async (_io: unknown, id: string) => ({
        id,
        name: '客户一',
        company: '公司',
        level: 'vip',
        phone: '13800000000',
        sessions: 12,
        tickets: 3,
        lastActive: 'now',
        tags: ['重点客户'],
        remark: '备注',
    })),
    updateCustomer: vi.fn(async (_io: unknown, id: string, body: { level?: string }) => ({
        id,
        name: '客户一',
        company: '公司',
        level: body.level ?? 'vip',
        phone: '13800000000',
        sessions: 12,
        tickets: 3,
        lastActive: 'now',
        tags: [],
        remark: '',
    })),
}))

import { fetchCustomerDetail, updateCustomer } from '@/api/customer'
import { indexStore } from '@/pages/index/store'

describe('首页 store：详情抽屉与等级更新', () => {
    beforeEach(() => {
        localStorage.clear()
        setActivePinia(createPinia())
    })

    it('openDetail：落 id、开抽屉、骨架归零后拉详情', async () => {
        const store = indexStore('t')()

        store.openDetail('c_1')

        expect(store.local.activeId).toBe('c_1')
        expect(store.local.detailOpen).toBe(true)
        // 拉取未回前，抽屉里是空骨架而不是上一位客户的数据
        expect(store.remote.detailIo.data.id).toBe('')
        // saveIo 的初始态也是 loading，保存按钮必须靠 local.saving 才不会一进抽屉就转
        expect(store.remote.saveIo.status).toBe('loading')
        expect(store.local.saving).toBe(false)

        await vi.waitFor(() => expect(store.remote.detailIo.status).toBe('success'))
        expect(fetchCustomerDetail).toHaveBeenCalledWith(expect.anything(), 'c_1')
        expect(store.remote.detailIo.data.name).toBe('客户一')
    })

    it('pickedLevel：未选过用详情回填，选过以 local 为准', async () => {
        const store = indexStore('t')()
        store.openDetail('c_1')
        await vi.waitFor(() => expect(store.remote.detailIo.status).toBe('success'))

        expect(store.pickedLevel).toBe('vip')

        store.pickLevel('svip')
        expect(store.local.pendingLevel).toBe('svip')
        expect(store.pickedLevel).toBe('svip')
    })

    it('saveLevel：带着当前等级提交，成功后收抽屉并重拉列表', async () => {
        const store = indexStore('t')()
        await store.fetchList()
        store.openDetail('c_1')
        await vi.waitFor(() => expect(store.remote.detailIo.status).toBe('success'))

        store.pickLevel('svip')
        await store.saveLevel()

        expect(updateCustomer).toHaveBeenCalledWith(expect.anything(), 'c_1', { level: 'svip' })
        expect(store.local.detailOpen).toBe(false)
        expect(store.remote.saveIo.data.level).toBe('svip')
        // 列表首载 + 保存后重拉，共两次
        expect(store.remote.listIo.data.total).toBe(1)
    })

    it('详情拉取失败：状态落 error 但 data 仍是骨架，saving 不为真', async () => {
        vi.mocked(fetchCustomerDetail).mockRejectedValueOnce(new Error('boom'))
        const store = indexStore('t')()

        store.openDetail('c_9')
        await vi.waitFor(() => expect(store.remote.detailIo.status).toBe('error'))

        expect(store.remote.detailIo.error?.message).toBe('boom')
        expect(store.remote.detailIo.data.level).toBe('')
        expect(store.local.saving).toBe(false)
        // 失败不关抽屉：ReadData 会在面板内给重试入口
        expect(store.local.detailOpen).toBe(true)
    })
})
