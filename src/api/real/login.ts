/**
 * 登录接口封装（真实现）
 * 用法示例：
 *   await loginIo.run(io => login(io, { method: 'password', account, password }))
 *
 * VITE_API_MOCK=on 时 vite alias 把 '@/api' 指向 src/api/mock，业务代码与 store 无需改动
 */
import { http } from '@/api/client'
import type { IOCtx } from '@/utils/io'
import type { LoginParams, LoginResult, SendSmsCodeResult } from '../types/login'

export type * from '../types/login'

// 统一登录入口：method 判别，后端按方式走各自的校验链
export const login = (io: IOCtx<LoginResult>, params: LoginParams): Promise<LoginResult> => {
    return http.post(io, { url: '/api/v1/auth/login', data: params }).then(res => res.data)
}

// 下发手机验证码（生产环境频控由后端负责，前端只做倒计时）
export const sendSmsCode = (io: IOCtx<SendSmsCodeResult>, phone: string): Promise<SendSmsCodeResult> => {
    return http.post(io, { url: '/api/v1/auth/sms-code', data: { phone } }).then(res => res.data)
}

// 供类型校验使用：保证导出集合完整（新增接口时此处会提示遗漏）
export type LoginApi = {
    login: typeof login
    sendSmsCode: typeof sendSmsCode
    params: LoginParams
    result: LoginResult
}
