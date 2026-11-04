/**
 * 客户域 mock 替身：与 ../real/customer 同签名、同类型
 * 真实现用相对路径导入（不受 '@/api' 别名影响），签名漂移会直接编译报错
 * 调试开关（改完保存即生效，无需重启）：FAIL / RANDOM_FAIL_RATE
 * 数据由 entityStore 驻留内存：updateCustomer 的改动会在后续 list/detail 立刻回读生效
 */
import type * as Real from '../real/customer'
import * as mock from '@/utils/mock'

// 置为 { message: 'Network Error', code: 'ERR_NETWORK' } 可验证 error 态与中文文案映射
const FAIL: mock.MockFail | null = null

// 置为 0.1 可演示偶发失败（每次请求独立掷骰，用于验证 refresh 后落 error 态的界面）
const RANDOM_FAIL_RATE = 0

// 57 条种子一次成型：id 加前缀转字符串，详情比列表多 tags/remark 两个字段
const seed: Real.CustomerDetail[] = mock
    .gen<{ list: Real.CustomerDetail[] }>({
        'list|57': [
            {
                'id|+1': 1,
                name: '@cname',
                company: '@ctitle(6, 12)',
                level: 'vip',
                phone: /1[3-9]\d{9}/,
                'sessions|10-200': 1,
                'tickets|0-20': 1,
                lastActive: '@datetime',
                'tags|0-2': ['重点客户', '流失预警', '新客户'],
                remark: '@cparagraph(1, 2)',
            },
        ],
    })
    .list.map((item, index) => ({ ...item, id: `c_${index + 1}` }))

const store = mock.createEntityStore<Real.CustomerDetail>(seed)

// FAIL 开关优先，其次概率注入；respond 的 fail 收 null 即放行
const injectFail = (): mock.MockFail | null =>
    FAIL ??
    mock.maybeFail(RANDOM_FAIL_RATE, [
        { message: 'Network Error', code: 'ERR_NETWORK' },
        { message: 'Request Timeout', code: 'ERR_BAD_RESPONSE' },
    ])

export const fetchCustomerList: typeof Real.fetchCustomerList = (io, params) =>
    mock.respond(io, store.page(params.page, params.pageSize), { fail: injectFail() })

export const fetchCustomerDetail: typeof Real.fetchCustomerDetail = (io, id) =>
    mock.respond(io, store.get(id), { fail: injectFail() })

export const updateCustomer: typeof Real.updateCustomer = (io, id, body) =>
    mock.respond(io, store.update(id, body), { fail: injectFail() })

// 类型继续透出：业务侧 import type { CustomerItem } from '@/api/customer' 不受替换影响
export type * from '../types/customer'
