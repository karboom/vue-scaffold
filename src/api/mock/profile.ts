/**
 * 用户资料 mock 替身：与 ../real/profile 同签名、同类型
 * 真实现用相对路径导入（不受 '@/api' 别名影响），签名漂移会直接编译报错
 */
import type * as Real from '../real/profile'
import * as mock from '@/utils/mock'

const profile: Real.ProfileItem = {
    id: 'u_1',
    name: '演示用户',
    email: 'demo@example.com',
    avatar: '',
}

// delay 缺省即约定：随机 0-1s
export const fetchProfile: typeof Real.fetchProfile = io => mock.respond(io, profile)

// 类型继续透出：业务侧 import type { ProfileItem } from '@/api/profile' 不受替换影响
export type * from '../types/profile'
