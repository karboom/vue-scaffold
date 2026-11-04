/**
 * 客户域类型（仅类型）
 * 单独成文件的原因：mock 替身要复用同一份类型，而实现文件会被 vite alias 整体替换
 */

export type CustomerItem = {
    id: string
    name: string
    company: string
    level: string
    phone: string
    sessions: number
    tickets: number
    lastActive: string
}

export type CustomerDetail = CustomerItem & {
    tags: string[]
    remark: string
}

export type CustomerListParams = {
    page: number
    pageSize: number
    level?: string
    keyword?: string
}

export type CustomerListResult = {
    list: CustomerItem[]
    total: number
    page: number
    pageSize: number
}

export type UpdateCustomerBody = {
    level?: string
    phone?: string
    remark?: string
}
