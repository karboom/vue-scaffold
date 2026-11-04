/**
 * 用户资料接口封装（真实现）
 * VITE_API_MOCK=on 时 vite alias 把 '@/api' 指向 src/api/mock，业务代码与 store 无需改动
 */
import { http } from '@/api/client'
import type { IOCtx } from '@/utils/io'
import type { ProfileItem } from '../types/profile'

export type * from '../types/profile'

// 拉取当前登录用户资料
export const fetchProfile = (io: IOCtx<ProfileItem | null>): Promise<ProfileItem | null> => {
    return http.get(io, { url: '/api/profile' }).then(res => res.data)
}
