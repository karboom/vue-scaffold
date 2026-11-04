/**
 * 登录域 mock 替身：与 ../real/login 同签名、同类型
 * 真实现用相对路径导入（不受 '@/api' 别名影响），签名漂移会直接编译报错
 * 调试开关（改完保存即生效，无需重启）：FAIL
 * 演示语义：任意账号/密码/验证码都放行，token 里带 method 便于确认走了哪条链路
 */
import * as log from '@/utils/log'
import type * as Real from '../real/login'
import * as mock from '@/utils/mock'

// 置为 { message: '账号或密码错误', code: 'ERR_BAD_CREDENTIALS' } 可验证错误态文案展示
const FAIL: mock.MockFail | null = null

const user: Real.LoginUser = { id: 'u_1', name: '演示用户', avatar: '' }

export const login: typeof Real.login = (io, params) => {
    log.info(`[mock] 登录请求 ${params.method}`, params)

    const result: Real.LoginResult = { token: `tk_${params.method}_${Date.now()}`, user }
    return mock.respond(io, result, { fail: FAIL })
}

export const sendSmsCode: typeof Real.sendSmsCode = (io, phone) => {
    log.info('[mock] 下发短信验证码', phone)

    const result: Real.SendSmsCodeResult = { expireSeconds: 60 }
    return mock.respond(io, result, { fail: FAIL })
}

// 类型继续透出：业务侧 import type { LoginParams } from '@/api/login' 不受替换影响
export type * from '../types/login'
