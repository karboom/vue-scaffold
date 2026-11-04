import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as log from '@/utils/log'

/**
 * 日志出口的用例：重点不在 console 打了什么，而在"上报槽位"这层契约——
 * 未注入零开销、注入后只喂 error、上报器自己炸了不许影响业务。
 */
describe('log：error 异步上报出口', () => {
    let spyError: ReturnType<typeof vi.spyOn>
    let spyWarn: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        spyError = vi.spyOn(console, 'error').mockImplementation(() => {})
        spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        log.setLogReporter(null)
        spyError.mockRestore()
        spyWarn.mockRestore()
    })

    it('未注入上报器：error 只落 console，调用方无感', () => {
        expect(() => log.error('业务炸了', { code: 'E1' })).not.toThrow()
        expect(spyError).toHaveBeenCalledWith('业务炸了', { code: 'E1' })
    })

    it('注入后：error 结构化成 LogRecord，保留原始 details 与时序', () => {
        const reporter = vi.fn()
        log.setLogReporter(reporter)
        const before = Date.now()

        log.error('请求失败', 'GET /api', 500)

        expect(reporter).toHaveBeenCalledOnce()
        const [record] = reporter.mock.calls[0] as [log.LogRecord]
        expect(record.level).toBe('error')
        expect(record.message).toBe('请求失败')
        expect(record.details).toEqual(['GET /api', 500])
        expect(record.at).toBeGreaterThanOrEqual(before)
    })

    it('非 error 级别不进上报通道：带宽留给真故障', () => {
        const reporter = vi.fn()
        log.setLogReporter(reporter)

        log.info('加载列表', 1)
        log.warn('慢请求', 1200)
        log.debug('待上报', 2)

        expect(reporter).not.toHaveBeenCalled()
    })

    it('上报器抛错就地吞掉：监控自身故障不得拖垮业务', () => {
        log.setLogReporter(() => {
            throw new Error('上报器崩了')
        })

        expect(() => log.error('原始错误')).not.toThrow()
        expect(spyError).toHaveBeenCalledWith('原始错误')
        expect(spyWarn).toHaveBeenCalledWith('日志上报器异常，已忽略', expect.any(Error))
    })

    it('摘除上报器后回到零开销路径', () => {
        const reporter = vi.fn()
        log.setLogReporter(reporter)
        log.error('第一条')
        expect(reporter).toHaveBeenCalledOnce()

        log.setLogReporter(null)
        log.error('第二条')
        expect(reporter).toHaveBeenCalledOnce()
    })
})
