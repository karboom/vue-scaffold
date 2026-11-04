import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Router } from 'vue-router'

// 拦截 api 模块：store 走的是 '@/api/login'（vitest 下解析到 real），单测只验证编排逻辑
vi.mock('@/api/login', () => ({
    login: vi.fn(async (_io: unknown, params: { method: string }) => ({
        token: `tk_${params.method}`,
        user: { id: 'u_1', name: '演示用户', avatar: '' },
    })),
    sendSmsCode: vi.fn(async () => ({ expireSeconds: 60 })),
}))

import { login, sendSmsCode } from '@/api/login'
import { loginStore } from '@/pages/login/store'
import { sessionStore } from '@/store'

const fakeRouter = () => {
    const push = vi.fn()
    return { push, router: { push } as unknown as Router }
}

describe('登录页 store：多方式登录', () => {
    beforeEach(() => {
        localStorage.clear()
        setActivePinia(createPinia())
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('账号密码登录成功：落 token 并回跳来源页', async () => {
        const store = loginStore('t')()
        const { push, router } = fakeRouter()
        store.local.account = 'demo'
        store.local.password = 'pwd123'

        await store.submit(router, '/home')

        expect(login).toHaveBeenCalledOnce()
        expect(sessionStore('app')().local.token).toBe('tk_password')
        expect(push).toHaveBeenCalledWith('/home')
        expect(store.local.submittingMethod).toBeNull()
    })

    it('验证码登录：入参为手机号与短信码', async () => {
        const store = loginStore('t')()
        const { router } = fakeRouter()
        store.local.activeTab = 'sms'
        store.local.phone = '13800000000'
        store.local.smsCode = '123456'

        await store.submit(router, '/')

        expect(login).toHaveBeenCalledWith(expect.anything(), {
            method: 'sms',
            phone: '13800000000',
            code: '123456',
        })
        expect(sessionStore('app')().local.token).toBe('tk_sms')
    })

    it('发送验证码成功后进入倒计时，归零自动恢复可重发', async () => {
        vi.useFakeTimers()
        const store = loginStore('t')()
        store.local.phone = '13800000000'

        await store.sendSms()

        expect(sendSmsCode).toHaveBeenCalledWith(expect.anything(), '13800000000')
        expect(store.local.countdown).toBe(60)
        expect(store.smsSent).toBe(true)

        vi.advanceTimersByTime(3000)
        expect(store.local.countdown).toBe(57)

        vi.advanceTimersByTime(57000)
        expect(store.local.countdown).toBe(0)
        store.stopCountdown()
    })

    it('钉钉登录：授权码换 token', async () => {
        const store = loginStore('t')()
        const { router } = fakeRouter()

        await store.loginByDingtalk(router, '/')

        expect(login).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'dingtalk' }))
        expect(sessionStore('app')().local.token).toBe('tk_dingtalk')
    })

    it('指纹登录：WebAuthn 签名换 token', async () => {
        const store = loginStore('t')()
        const { router } = fakeRouter()

        await store.loginByBiometric(router, '/')

        expect(login).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'biometric' }))
        expect(sessionStore('app')().local.token).toBe('tk_biometric')
    })

    it('登录失败：不落 token，错误文案经 getter 可读', async () => {
        const store = loginStore('t')()
        const { push, router } = fakeRouter()
        vi.mocked(login).mockRejectedValueOnce(
            Object.assign(new Error('账号或密码错误'), { code: 'ERR_BAD_CREDENTIALS' }),
        )
        store.local.account = 'demo'
        store.local.password = 'bad'

        await store.submit(router, '/')

        expect(store.remote.loginIo.status).toBe('error')
        expect(store.loginError).toBe('账号或密码错误')
        expect(sessionStore('app')().local.token).toBe('')
        expect(push).not.toHaveBeenCalled()
    })

    it('表单不完整时 canSubmit 为假', () => {
        const store = loginStore('t')()

        expect(store.canSubmit).toBe(false)
        store.local.account = 'demo'
        expect(store.canSubmit).toBe(false)
        store.local.password = 'pwd'
        expect(store.canSubmit).toBe(true)
    })
})
