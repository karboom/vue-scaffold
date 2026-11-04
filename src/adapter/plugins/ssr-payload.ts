import { IOCtx, type IOStatus } from '@/utils/io'

/**
 * IOCtx 的 SSR payload 适配。
 *
 * @pinia/nuxt 会把整个 pinia state 塞进 payload.pinia，而 IOCtx 持有 AbortController / Error，
 * devalue 对类实例直接抛 `Cannot stringify arbitrary non-POJOs`——只要页面上建过含 IOCtx 的 store，
 * SSR 渲染就会 500。这里把它降级成纯数据，水合时重建实例，ReadData 的 :io 契约因此零改动。
 *
 * 两个宏都依赖 Nuxt 实例（reducer 读 ssrContext、reviver 挂在 _payloadRevivers 上），
 * 且必须在解析 payload 之前注册——defineNuxtPlugin({ enforce: 'pre' }) 仍晚于 payload 解析，
 * 所以这里用 definePayloadPlugin（构建期被排到 user-revivers 位）。
 */

type SerializedIOCtx = {
    status: IOStatus
    hasLoaded: boolean
    data: unknown
    /** code 要留：ReadData 按 error.code 映射 i18n 文案 */
    error?: { name: string; code?: string; message: string }
}

export default definePayloadPlugin(() => {
    definePayloadReducer('IOCtx', value => {
        if (!(value instanceof IOCtx)) {
            return undefined
        }
        const serialized: SerializedIOCtx = {
            status: value.status,
            hasLoaded: value.hasLoaded,
            data: value.data,
        }
        if (value.error) {
            const error = value.error as { name?: string; code?: string; message?: string }
            serialized.error = {
                name: error.name ?? 'Error',
                code: error.code,
                message: error.message ?? '',
            }
        }
        return serialized
    })

    definePayloadReviver('IOCtx', (data: SerializedIOCtx) => {
        const io = new IOCtx(data.data)
        io.status = data.status
        io.hasLoaded = data.hasLoaded
        if (data.error) {
            const error: Error & { code?: string } = new Error(data.error.message)
            error.name = data.error.name
            error.code = data.error.code
            io.error = error
        }
        return io
    })
})
