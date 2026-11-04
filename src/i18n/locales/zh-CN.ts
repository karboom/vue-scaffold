/**
 * 中文词典：唯一文案源，同时派生其他语言的结构类型
 * key 语义化命名（common / layout / error / pages.<page>），不要按 UI 控件命名
 */

const layout = {
    search: '全局搜索',
    expand: '展开',
    collapse: '收起',
    notifications: '通知',
    notLoggedIn: '未登录',
    menu: {
        scaffold: '脚手架',
        demo: 'Demo 首页',
        chat: 'AI 聊天',
    },
    profile: {
        info: '个人信息',
        logout: '退出登录',
    },
} as const

const common = {
    appName: '测试后台模板',
    retry: '重试',
    empty: '暂无数据',
    requestCanceled: '请求已取消',
} as const

const error = {
    network: '网络连接失败，请检查网络或后端服务',
    timeout: '请求超时，请稍后重试',
    unknown: '加载失败：{message}',
} as const

const pages = {
    index: {
        title: 'Demo 首页',
        cardTitle: 'Vue3 + Vite + Pinia + Nuxt UI 脚手架',
        intro: '下方列表即脚手架标准写法：store 工厂 + IOCtx 状态机 + api 封装 + ReadData 四态渲染；「详情」按钮串起 Button 触点、Detail 抽屉与 Confirm 动作区。当前接口{mode}。',
        mockOn: '走 mock 替身',
        mockOff: '走真实后端',
        reload: '重新加载',
        pageOf: '第 {page} 页 · 共 {total} 条',
        columns: {
            name: '客户',
            company: '公司',
            phone: '电话',
            level: '等级',
            lastActive: '最近活跃',
            actions: '操作',
        },
        actions: {
            detail: '详情',
            upgrade: '调整等级',
            save: '保存',
            close: '关闭',
        },
        detail: {
            title: '客户详情',
            sessions: '会话数',
            tickets: '工单数',
            tags: '标签',
            remark: '备注',
        },
    },
    login: {
        title: '登录',
        tabPassword: '账号密码',
        tabSms: '手机验证码',
        account: '账号',
        password: '密码',
        phone: '手机号',
        code: '验证码',
        sendCode: '获取验证码',
        resendCode: '{seconds} 秒后重发',
        codeSent: '验证码已发送（演示环境任意验证码可通过）',
        errRequired: '必填',
        errPhone: '手机号格式不正确',
        errCode: '验证码格式不正确',
        submit: '登录',
        oauthTitle: '其他方式登录',
        dingtalk: '钉钉登录',
        wechat: '微信登录',
        biometric: '指纹登录',
    },
    chat: {
        title: 'AI 聊天',
        intro: '本页是 websocket 封装的示例消费方：历史走信封 ack 配对，发送 fire-and-forget，回复由服务端按 start/delta/done 流式推送（mock 模式由纯前端替身模拟，不建真实连接）。订阅建立后不发一句话，AI 也会主动推一条——留意自动出现的气泡。',
        placeholder: '给 AI 发消息，回车发送',
        send: '发送',
    },
    notFound: {
        title: '页面不存在',
        desc: '你访问的页面可能已被移除、改名，或链接有误。',
        home: '返回首页',
        back: '返回上一页',
    },
} as const

export const zhCN = {
    common,
    layout,
    error,
    pages,
} as const

// 叶子放宽成 string，只保留结构：其他语言缺 key / 多 key 直接编译报错
type DeepString<T> = {
    [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>
}

export type MessageSchema = DeepString<typeof zhCN>
