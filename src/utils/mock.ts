/**
 * mock 基建 helper：把"立即 return"改造成可观测的 IO 生命周期，并把各域替身的重复套路下沉到一处
 * - respond：delay 默认随机 0-1s，让 IOCtx 的 loading / refreshing 态真的出现
 * - abort：与 IOCtx.run() 的 abort 语义对齐，抛 CanceledError（axios.isCancel 才会静默忽略）
 * - fail / maybeFail：抛带 code 的错误，让 ReadData 的错误文案映射生效
 * - gen：Mock.mock 产物的统一断言出口
 * - createBroadcaster / createStreamer：假推送订阅与假流式（start/delta/done）引擎
 * - createEntityStore：内存 CRUD，让"编辑后再查"有回读效果
 */
import { CanceledError } from 'axios'
import Mock from 'mockjs'
import type { IOCtx } from '@/utils/io'

export type MockFail = {
    message: string
    code: string
}

/** 随机 0-1s 延时：贴近真实网络抖动，让 loading 态在演示里可感知 */
export const randDelay = (): number => Math.floor(Math.random() * 1000)

export type RespondOptions = {
    /** 缺省走 randDelay()（约定：mock 延迟随机 0-1s）；演示要调骨架屏时长可显式传值 */
    delay?: number
    /** 传 null 表示放行：mock 文件里的 FAIL 开关可直接喂进来，不用 `?? undefined` */
    fail?: MockFail | null
}

/**
 * 为什么这样设计：mock 若只是"立即 return 数据"，IOCtx 的 loading/error 态在界面上根本不可达，
 * 页面等于永远只测过 success 分支。所以这里把一次假响应拆成真实世界的三个可观测瞬间——
 * 1) 先等 delay（loading 可见，abort 信号对齐 IOCtx.run：抛 CanceledError 而非吞掉，
 *    这样 axios.isCancel 的静默忽略逻辑在 mock 下同样成立，refreshing 取消的界面行为可被演示）；
 * 2) 再判 fail（错误要"延迟之后"才抛，用户才能先看到骨架、后看到错误文案，时序与真实网络一致）；
 * 3) 最后才给数据。fail 收 null 是给 mock 文件的 FAIL/RANDOM_FAIL_RATE 开关直喂用的，
 * 免得调用点写 `?? undefined` 这种类型胶水。
 */
export const respond = async <T>(io: IOCtx<any>, data: T, opts: RespondOptions = {}): Promise<T> => {
    const delay = opts.delay ?? randDelay()

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay)
        io.controller.signal.addEventListener(
            'abort',
            () => {
                clearTimeout(timer)
                reject(new CanceledError())
            },
            { once: true },
        )
    })

    if (opts.fail) {
        throw Object.assign(new Error(opts.fail.message), { code: opts.fail.code })
    }

    return data
}

/**
 * mockjs 模板生成器：产物断言成业务形状只发生在这里。
 * 模板键（'list|N'、'id|+1'）与产物类型天然不一致，泛型推断随宿主 tsconfig 漂移
 * （Nuxt 的 noUncheckedIndexedAccess 更严），调用方拿到的就是干净的 T
 */
export const gen = <T>(template: object): T => {
    return Mock.mock(template) as unknown as T
}

/**
 * 概率故障注入：rate 命中时从候选池随机挑一个 MockFail，否则返回 null。
 * rate=0 恒放行——演示"偶发错误态"时把它调到 0.1 即可，不用手改开关
 */
export const maybeFail = (rate: number, candidates: MockFail[]): MockFail | null => {
    if (Math.random() >= rate) {
        return null
    }
    // Nuxt 宿主 noUncheckedIndexedAccess 下取址可能是 undefined：兜 null 视同放行
    return candidates[Math.floor(Math.random() * candidates.length)] ?? null
}

/**
 * 广播器：订阅即 unsubscribe 的反操作可直接返回给业务侧；
 * onAwake 在 listeners 由空转非空的瞬间触发一次，供"页面挂载即可重演"的推送剧本上膛
 */
export const createBroadcaster = <M>() => {
    const listeners = new Set<(message: M) => void>()
    let awake: (() => void) | null = null

    return {
        publish: (message: M): void => {
            listeners.forEach(func => func(message))
        },
        subscribe: (handler: (message: M) => void): (() => void) => {
            const wasEmpty = listeners.size == 0
            listeners.add(handler)
            if (wasEmpty) {
                awake?.()
            }
            return () => {
                listeners.delete(handler)
            }
        },
        /** 有无监听者：流式引擎据此决定"无人订阅不排程"，避免定时器幽灵推给死监听 */
        hasListeners: (): boolean => listeners.size > 0,
        onAwake: (func: () => void): void => {
            awake = func
        },
    }
}

/** 流式排程的抽象事件：业务侧各自映射成域名义的信封（如 ChatIncoming 的 start/delta/done） */
export type StreamEvent =
    { id: string; phase: 'start' } | { id: string; phase: 'delta'; delta: string } | { id: string; phase: 'done' }

// 罐头文本按 2~6 字随机切段：模拟 tokenizer 出字节奏
const splitChunks = (text: string): string[] => {
    const chunks: string[] = []
    let index = 0
    while (index < text.length) {
        const size = 2 + Math.floor(Math.random() * 5)
        chunks.push(text.slice(index, index + size))
        index += size
    }
    return chunks
}

/**
 * 假流式引擎：一次性排定 start/delta/done——思考延迟（randDelay）在前、
 * 片段间 30-90ms、末片段后 100ms 收口；messageId 由 idPrefix + 自增计数生成
 */
export const createStreamer = (opts: {
    emit: (event: StreamEvent) => void
    /** 返回 false 时不排程：页面已卸载就不用定时器空转 */
    active?: () => boolean
    idPrefix?: string
}): ((text: string) => void) => {
    let counter = 0
    const prefix = opts.idPrefix ?? 'stream'

    return (text: string): void => {
        if (opts.active && !opts.active()) {
            return
        }
        const id = `${prefix}_${++counter}`
        opts.emit({ id, phase: 'start' })

        const chunks = splitChunks(text)
        let elapsed = randDelay()
        chunks.forEach(delta => {
            elapsed += 30 + Math.random() * 60
            setTimeout(() => opts.emit({ id, phase: 'delta', delta }), elapsed)
        })
        setTimeout(() => opts.emit({ id, phase: 'done' }), elapsed + 100)
    }
}

/**
 * 内存 CRUD：seed 一次后改动驻留，list/detail 查询即刻生效，
 * 演示才有"编辑 → 回读"的真实感；id 不存在视为调用方 bug，直接抛
 */
export const createEntityStore = <T extends { id: string }>(seed: T[]) => {
    const db = new Map<string, T>(seed.map(item => [item.id, item]))

    const get = (id: string): T => {
        const found = db.get(id)
        if (found == null) {
            throw new Error(`[mock] 实体不存在：${id}`)
        }
        return found
    }

    return {
        /** 分页读取，返回业务通用的 { list, total, page, pageSize } 形状 */
        page: (page: number, pageSize: number) => {
            const slice = Array.from(db.values()).slice((page - 1) * pageSize, page * pageSize)
            return { list: slice, total: db.size, page, pageSize }
        },
        get,
        /** 部分更新并写回，返回合并后的新值（spread 出新对象，不泄漏内部引用） */
        update: (id: string, patch: Partial<T>): T => {
            const next = { ...get(id), ...patch }
            db.set(id, next)
            return next
        },
    }
}
