/**
 * 客户接口封装（真实现）
 * 用法示例：
 *   await listIo.run(io => fetchCustomerList(io, { common: 1, pageSize: 10 }))
 *
 * VITE_API_MOCK=on 时 vite alias 把 '@/api' 指向 src/api/mock，业务代码与 store 无需改动
 */
import { http } from '@/api/client'
import type { IOCtx } from '@/utils/io'
import type {
    CustomerDetail,
    CustomerItem,
    CustomerListParams,
    CustomerListResult,
    UpdateCustomerBody,
} from '../types/customer'

export type * from '../types/customer'

// 分页拉取客户列表
export const fetchCustomerList = (
    io: IOCtx<CustomerListResult>,
    params: CustomerListParams,
): Promise<CustomerListResult> => {
    return http.get(io, { url: '/api/v1/customers', params }).then(res => res.data)
}

// 拉取客户详情
export const fetchCustomerDetail = (io: IOCtx<CustomerDetail>, id: string): Promise<CustomerDetail> => {
    return http.get(io, { url: `/api/v1/customers/${id}` }).then(res => res.data)
}

// 更新客户资料
export const updateCustomer = (
    io: IOCtx<CustomerDetail>,
    id: string,
    body: UpdateCustomerBody,
): Promise<CustomerDetail> => {
    return http.put(io, { url: `/api/v1/customers/${id}`, data: body }).then(res => res.data)
}

// 供类型校验使用：保证导出集合完整（新增接口时此处会提示遗漏）
export type CustomerApi = {
    fetchCustomerList: typeof fetchCustomerList
    fetchCustomerDetail: typeof fetchCustomerDetail
    updateCustomer: typeof updateCustomer
    item: CustomerItem
    listParams: CustomerListParams
}
