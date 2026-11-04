import { describe, expect, it } from 'vitest'
import { CanceledError } from 'axios'
import { IOCtx } from '@/utils/io'

describe('IOCtx', () => {
    it('初始为首载 loading，尚无历史成功记录', () => {
        const io = new IOCtx<number>(0)

        expect(io.status).toBe('loading')
        expect(io.hasLoaded).toBe(false)
        expect(io.refreshing).toBe(false)
    })

    it('首次拉取进入 loading，成功后回写数据', async () => {
        const io = new IOCtx<number>(0)
        const seen: string[] = []

        await io.run(async ctx => {
            seen.push(ctx.status)
            return 1
        })

        expect(seen).toEqual(['loading'])
        expect(io.data).toBe(1)
        expect(io.status).toBe('success')
        expect(io.hasLoaded).toBe(true)
        expect(io.refreshing).toBe(false)
    })

    it('历史成功后再次拉取处于 loading，并由 refreshing 标识', async () => {
        const io = new IOCtx<number>(0)
        await io.run(async () => 1)

        const seen: string[] = []
        await io.run(async ctx => {
            seen.push(ctx.status)
            expect(ctx.refreshing).toBe(true)
            return 2
        })

        expect(seen).toEqual(['loading'])
        expect(io.data).toBe(2)
        expect(io.status).toBe('success')
    })

    it('失败时保留旧数据并记录错误', async () => {
        const io = new IOCtx<number>(0)
        await io.run(async () => 7)

        const failure = new Error('请求失败')
        await io.run(async () => {
            throw failure
        })

        expect(io.data).toBe(7)
        expect(io.error).toBe(failure)
        expect(io.status).toBe('error')
        expect(io.hasLoaded).toBe(true)
    })

    it('首载取消进入 canceled，不记录错误', async () => {
        const io = new IOCtx<number>(0)

        await io.run(async () => {
            throw new CanceledError()
        })

        expect(io.error).toBeUndefined()
        expect(io.data).toBe(0)
        expect(io.status).toBe('canceled')
        expect(io.hasLoaded).toBe(false)
    })

    it('首载取消后可以重试成功', async () => {
        const io = new IOCtx<number>(0)
        await io.run(async () => {
            throw new CanceledError()
        })

        await io.run(async () => 5)

        expect(io.status).toBe('success')
        expect(io.hasLoaded).toBe(true)
        expect(io.data).toBe(5)
    })

    it('刷新取消回到 success 并保留旧数据', async () => {
        const io = new IOCtx<number>(0)
        await io.run(async () => 7)

        let rejectRun!: (reason: unknown) => void
        const pending = io.run(
            () =>
                new Promise<number>((_, reject) => {
                    rejectRun = reject
                }),
        )

        expect(io.refreshing).toBe(true)
        io.controller.abort()
        rejectRun(new CanceledError())
        await pending

        expect(io.status).toBe('success')
        expect(io.error).toBeUndefined()
        expect(io.data).toBe(7)
        expect(io.hasLoaded).toBe(true)
    })

    it('成功后清除上一次的错误', async () => {
        const io = new IOCtx<number>(0)
        await io.run(async () => {
            throw new Error('第一次失败')
        })
        expect(io.status).toBe('error')

        await io.run(async () => 1)

        expect(io.error).toBeUndefined()
        expect(io.status).toBe('success')
        expect(io.data).toBe(1)
    })

    it('过期请求的结果不覆盖新请求', async () => {
        const io = new IOCtx<number>(0)
        let resolveOld!: (value: number) => void
        const oldRun = io.run(
            () =>
                new Promise<number>(resolve => {
                    resolveOld = resolve
                }),
        )

        await io.run(async () => 2)
        resolveOld(1)
        await oldRun

        expect(io.data).toBe(2)
        expect(io.status).toBe('success')
        expect(io.hasLoaded).toBe(true)
        expect(io.error).toBeUndefined()
    })

    it('过期请求的失败不覆盖新请求', async () => {
        const io = new IOCtx<number>(0)
        let rejectOld!: (reason: unknown) => void
        const oldRun = io.run(
            () =>
                new Promise<number>((_, reject) => {
                    rejectOld = reject
                }),
        )

        await io.run(async () => 3)
        rejectOld(new Error('旧请求失败'))
        await oldRun

        expect(io.data).toBe(3)
        expect(io.status).toBe('success')
        expect(io.error).toBeUndefined()
    })
})
