/**
 * 登录域类型（仅类型）
 * 单独成文件的原因：mock 替身要复用同一份类型，而实现文件会被 vite alias 整体替换
 */

/** 登录方式：账号密码 / 手机验证码 / 钉钉 / 微信 / 指纹（WebAuthn） */
export type LoginMethod = 'password' | 'sms' | 'dingtalk' | 'wechat' | 'biometric'

/**
 * 登录入参按 method 判别联合：
 * 每种方式只携带自己的凭证，sms 里塞 password 会直接编译报错
 */
export type LoginParams =
    | { method: 'password'; account: string; password: string }
    | { method: 'sms'; phone: string; code: string }
    | { method: 'dingtalk'; authCode: string }
    | { method: 'wechat'; authCode: string }
    | { method: 'biometric'; account: string; credential: string }

export type LoginUser = {
    id: string
    name: string
    avatar: string
}

export type LoginResult = {
    token: string
    user: LoginUser
}

export type SendSmsCodeResult = {
    /** 验证码有效期秒数：前端据此做重发倒计时 */
    expireSeconds: number
}
