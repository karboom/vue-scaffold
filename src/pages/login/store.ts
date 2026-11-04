import { defineStore } from 'pinia'
import type { Router } from 'vue-router'
import { IOCtx } from '@/utils/io'
import * as log from '@/utils/log'
import { sessionStore } from '@/store'
import {
    login,
    sendSmsCode,
    type LoginMethod,
    type LoginParams,
    type LoginResult,
    type SendSmsCodeResult,
} from '@/api/login'

/**
 * 登录页状态：多方式登录（账号密码 / 手机验证码 / 钉钉 / 微信 / 指纹）
 * 演示「页面级 store 工厂 + IOCtx 四态 + 事件直连 action + 卸载释放」
 * 用法：loginStore(id)()
 */

/** 表单型登录 tab：三方与指纹不走表单，直接触发动作 */
export type LoginTab = Extract<LoginMethod, 'password' | 'sms'>

export type LocalState = {
    activeTab: LoginTab
    account: string
    password: string
    phone: string
    smsCode: string
    /** 当前进行中的登录方式：按钮 loading 按它区分，null 表示空闲 */
    submittingMethod: LoginMethod | null
    /** 验证码请求是否在途：IOCtx 初始态也是 loading，按钮不能直接拿 status 当 spinner */
    smsSending: boolean
    /** 重发倒计时剩余秒数：>0 时发送按钮禁用并显示"稍后重发" */
    countdown: number
    /** setInterval 句柄：随组件卸载一并清理（非渲染数据，仅借用 local 的生命周期） */
    countdownTimer: number
}

export type RemoteState = {
    loginIo: IOCtx<LoginResult>
    smsIo: IOCtx<SendSmsCodeResult>
}

export type LoginState = {
    local: LocalState
    remote: RemoteState
}

export const loginStore = (id: string) =>
    defineStore(`login_${id}`, {
        state: (): LoginState => ({
            local: {
                activeTab: 'password',
                account: '',
                password: '',
                phone: '',
                smsCode: '',
                submittingMethod: null,
                smsSending: false,
                countdown: 0,
                countdownTimer: 0,
            },
            remote: {
                loginIo: new IOCtx<LoginResult>({ token: '', user: { id: '', name: '', avatar: '' } }),
                smsIo: new IOCtx<SendSmsCodeResult>({ expireSeconds: 0 }),
            },
        }),
        getters: {
            /** 登录按钮 loading 态 */
            submitting: (state): boolean => state.remote.loginIo.status == 'loading',
            /** 验证码发送按钮 loading 态 */
            sendingSms: (state): boolean => state.local.smsSending,
            /** 当前 tab 表单完整才允许提交 */
            canSubmit(): boolean {
                if (this.local.activeTab == 'password') {
                    return this.local.account != '' && this.local.password != ''
                }
                return this.local.phone != '' && this.local.smsCode != ''
            },
            /** 登录错误文案：空串代表无错误，模板据此决定是否渲染 UAlert */
            loginError(): string {
                return this.remote.loginIo.status == 'error' ? this.remote.loginIo.error!.message : ''
            },
            /** 验证码是否已发送：模板据此渲染"已发送"提示（空态→成功态） */
            smsSent(): boolean {
                return this.remote.smsIo.status == 'success'
            },
            /** 验证码发送错误文案：空串代表无错误 */
            smsError(): string {
                return this.remote.smsIo.status == 'error' ? this.remote.smsIo.error!.message : ''
            },
        },
        actions: {
            setTab(tab: LoginTab) {
                log.info('切换登录方式', tab)
                this.local.activeTab = tab
            },
            async sendSms() {
                log.info('发送手机验证码', this.local.phone)
                this.local.smsSending = true
                const io = this.remote.smsIo
                try {
                    await io.run(ctx => sendSmsCode(ctx, this.local.phone))
                } finally {
                    this.local.smsSending = false
                }
                if (io.status == 'success') {
                    this.startCountdown(io.data.expireSeconds)
                }
            },
            startCountdown(seconds: number) {
                this.stopCountdown()
                this.local.countdown = seconds
                // 每秒回退一格，归零自动恢复"重新发送"
                this.local.countdownTimer = window.setInterval(() => {
                    if (this.local.countdown <= 1) {
                        this.stopCountdown()
                        return
                    }
                    this.local.countdown -= 1
                }, 1000)
            },
            stopCountdown() {
                if (this.local.countdownTimer) {
                    clearInterval(this.local.countdownTimer)
                    this.local.countdownTimer = 0
                }
                this.local.countdown = 0
            },
            /** 提交当前 tab 的表单登录（账号密码 / 手机验证码） */
            async submit(router: Router, redirect: string) {
                const params: LoginParams =
                    this.local.activeTab == 'password'
                        ? { method: 'password', account: this.local.account, password: this.local.password }
                        : { method: 'sms', phone: this.local.phone, code: this.local.smsCode }
                await this.finishLogin(params, router, redirect)
            },
            /** 钉钉：真实项目先跳 OAuth 拿 authCode 再换 token，脚手架以假码走完整链路 */
            async loginByDingtalk(router: Router, redirect: string) {
                log.info('发起钉钉登录')
                await this.finishLogin({ method: 'dingtalk', authCode: `mock_dt_${Date.now()}` }, router, redirect)
            },
            /** 微信：同上，生产为授权码模式（open 平台 / 企业微信 corp） */
            async loginByWechat(router: Router, redirect: string) {
                log.info('发起微信登录')
                await this.finishLogin({ method: 'wechat', authCode: `mock_wx_${Date.now()}` }, router, redirect)
            },
            /**
             * 指纹：真实项目先本机 WebAuthn 校验（navigator.credentials.get）拿到签名再换 token；
             * 脚手架无 authenticator，直接以假签名走服务端链路，接入点见上面注释
             */
            async loginByBiometric(router: Router, redirect: string) {
                log.info('发起指纹登录')
                const account = this.local.account != '' ? this.local.account : 'demo'
                await this.finishLogin(
                    { method: 'biometric', account, credential: `mock_wa_${Date.now()}` },
                    router,
                    redirect,
                )
            },
            /** 所有方式共同的收口：IOCtx 跑接口 → 成功落 token → 回跳来源页 */
            async finishLogin(params: LoginParams, router: Router, redirect: string) {
                log.info('提交登录', params.method)
                this.stopCountdown()
                this.local.submittingMethod = params.method
                const io = this.remote.loginIo
                try {
                    await io.run(ctx => login(ctx, params))
                } finally {
                    this.local.submittingMethod = null
                }
                if (io.status != 'success') {
                    // 失败/取消不打扰用户以外的流程：错误文案由 loginError getter 交给模板展示
                    log.info('登录未成功', io.status)
                    return
                }
                sessionStore('app')().setToken(io.data.token)
                log.info('登录成功，跳转回来源页', redirect)
                await router.push(redirect)
            },
        },
    })
