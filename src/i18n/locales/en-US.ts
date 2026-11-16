/**
 * 英文词典：结构由 MessageSchema 约束，与 zh-CN 缺/多 key 都会编译报错
 * 插值名（{page}、{total}、{message}）必须与中文一致，改名要同步改调用点
 */
import type { MessageSchema } from './zh-CN'

export const enUS: MessageSchema = {
    common: {
        appName: 'Admin Console',
        retry: 'Retry',
        empty: 'No data',
        requestCanceled: 'Request canceled',
        noValue: '—',
        remoteNotConfigured: 'No federation host configured (NUXT_PUBLIC_MF_HOSTS is empty)',
        remoteLoadFailed: 'Failed to load the remote component; make sure the provider is online and versions match',
    },
    layout: {
        search: 'Search',
        expand: 'Expand',
        collapse: 'Collapse',
        notifications: 'Notifications',
        notLoggedIn: 'Not signed in',
        menu: {
            scaffold: 'Scaffold',
            demo: 'Demo home',
            chat: 'AI Chat',
            federation: 'Federation demo',
            remotePage: 'Remote page',
        },
        profile: {
            info: 'Profile',
            logout: 'Sign out',
        },
    },
    error: {
        network: 'Network unreachable, please check your connection or the API server',
        timeout: 'Request timed out, please try again later',
        unknown: 'Failed to load: {message}',
    },
    pages: {
        index: {
            title: 'Demo home',
            cardTitle: 'Vue3 + Vite + Pinia + Nuxt UI scaffold',
            intro: 'The list below shows the standard scaffold pattern: store factory + IOCtx state machine + api wrapper + ReadData; the Details button chains the Button touch target, the Detail drawer and the Confirm action area. Current API {mode}.',
            mockOn: 'is mocked',
            mockOff: 'hits the real backend',
            reload: 'Reload',
            pageOf: 'Page {page} · {total} items',
            columns: {
                name: 'Customer',
                company: 'Company',
                phone: 'Phone',
                level: 'Level',
                lastActive: 'Last active',
                actions: 'Actions',
            },
            actions: {
                detail: 'Details',
                upgrade: 'Change level',
                save: 'Save',
                close: 'Close',
            },
            detail: {
                title: 'Customer detail',
                sessions: 'Sessions',
                tickets: 'Tickets',
                tags: 'Tags',
                remark: 'Remark',
            },
        },
        login: {
            title: 'Sign in',
            tabPassword: 'Password',
            tabSms: 'SMS code',
            account: 'Account',
            password: 'Password',
            phone: 'Phone number',
            code: 'Code',
            sendCode: 'Send code',
            resendCode: 'Resend in {seconds}s',
            codeSent: 'Code sent (demo accepts any code)',
            errRequired: 'Required',
            errPhone: 'Invalid phone number',
            errCode: 'Invalid code',
            submit: 'Sign in',
            oauthTitle: 'Or sign in with',
            dingtalk: 'DingTalk',
            wechat: 'WeChat',
            biometric: 'Fingerprint',
        },
        chat: {
            title: 'AI Chat',
            intro: 'This page exercises the websocket wrapper end to end: history over an envelope ack, sending is fire-and-forget, replies stream in as start/delta/done pushes (in mock mode a pure front-end fake, no real connection). Stay subscribed without sending anything and the AI will still start a conversation on its own.',
            placeholder: 'Message the AI, Enter to send',
            send: 'Send',
        },
        federation: {
            title: 'Federation demo',
            intro: 'The component inside the card below is fetched at runtime by the browser from a sibling project built with VITE_MF=provider: plain JSON props go in, events come out, and the host keeps ssr:true without touching remote rendering. With an empty host list you get the "not configured" state; if the provider is offline you get a retryable error.',
            widgetTitle: 'Remote component (HelloWidget)',
            picked: 'Remote component reported: {item}',
        },
        remoteAbout: {
            title: 'Remote page',
        },
        notFound: {
            title: 'Page not found',
            desc: 'The page you requested may have been removed, renamed, or reached by a broken link.',
            home: 'Back to home',
            back: 'Go back',
        },
    },
}
