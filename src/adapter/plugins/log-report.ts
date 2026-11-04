import { http } from '@/api/client'
import * as log from '@/utils/log'
import type { LogRecord } from '@/utils/log'

/**
 * error 日志的异步上报通道：把 log.setLogReporter 的槽位接到应用 http 实例上。
 *
 * 设计目的：
 * - 复用 `@/api/client` 的实例而不是自己 new 一个：baseURL（SSR 侧补绝对 origin）、
 *   Authorization、X-Request-Id 与慢请求/失败遥测全部现成，上报请求和业务请求走同一套网关与排障链路；
 * - 批量 + 节流：攒够 MAX_BATCH 立刻发，否则每 FLUSH_INTERVAL_MS 发一次，
 *   页面连环报错不会打成散弹枪；
 * - 递归熔断：上报请求失败时 utils/http 会 `log.error('HTTP 请求失败', ...requestId=xxx)`，
 *   那条日志正是本通道自己产生的。这里给上报请求预先指定 X-Request-Id，
 *   入队时按该 id 把回声识别出来直接丢弃——比"在途期间一律丢弃"精确，不会误杀同期真错误；
 * - 熔断降速：连续失败到达上限后静默 COOLDOWN_MS，日志后端宕机不该持续吃用户的带宽；
 * - 只在客户端安装：服务端日志本就进 stdout / 进程采集，而插件每请求都会执行，
 *   在服务端起计时器会随请求数无上限泄漏。
 */

/** 攒够这么多条立刻冲刷 */
const MAX_BATCH = 20
/** 队列上限：超出丢最老的，宁可少报也不能让内存无上限长 */
const MAX_QUEUE = 200
/** 定时冲刷间隔 */
const FLUSH_INTERVAL_MS = 2000
/** 连续失败多少次进入静默 */
const FAILURE_LIMIT = 3
/** 静默时长 */
const COOLDOWN_MS = 60_000

let installed = false

export default defineNuxtPlugin(() => {
    const url = import.meta.env.VITE_LOG_REPORT_URL
    if (!import.meta.client || !url) {
        return
    }
    if (installed) {
        return
    }
    installed = true

    log.info('启用错误日志上报', url)

    const queue: LogRecord[] = []
    let failures = 0
    let cooldownUntil = 0
    /** 最近一次上报请求的自定 requestId：用于识别并丢弃"上报失败"这条回声日志 */
    let lastReportId = ''

    /** 冲刷一批：任何异常都在此截住，上报通道绝不允许把错误再抛回 log.error */
    const flush = async () => {
        if (queue.length == 0) {
            return
        }
        // 静默期内只保留最新的若干条：恢复后既不猛发，也不至于全丢
        if (failures >= FAILURE_LIMIT) {
            if (Date.now() < cooldownUntil) {
                if (queue.length > MAX_BATCH) {
                    queue.splice(0, queue.length - MAX_BATCH)
                }
                return
            }
            failures = 0
        }

        const batch = queue.splice(0, MAX_BATCH)
        const reportId = `log_report_${Date.now()}`
        lastReportId = reportId
        try {
            await http.client.post(
                url,
                {
                    page: location.href,
                    userAgent: navigator.userAgent,
                    records: batch,
                },
                {
                    headers: { 'X-Request-Id': reportId },
                    timeout: 5000,
                },
            )
            failures = 0
        } catch (reportError) {
            // 这里不能用 log.error：上报通道自己的失败再进日志系统就是无限回声
            failures += 1
            cooldownUntil = Date.now() + COOLDOWN_MS
            log.warn('错误日志上报失败，本批丢弃', batch.length, failures, reportError)
        }
    }

    log.setLogReporter(record => {
        // 回声识别：本批请求的失败日志（details 里带 requestId）直接丢，不再触发新一轮上报
        if (lastReportId && record.details.some(detail => String(detail).includes(lastReportId))) {
            return
        }
        queue.push(record)
        if (queue.length > MAX_QUEUE) {
            queue.splice(0, queue.length - MAX_QUEUE)
        }
        if (queue.length >= MAX_BATCH) {
            void flush()
            return
        }
        log.debug('错误日志待上报', queue.length)
    })

    window.setInterval(() => void flush(), FLUSH_INTERVAL_MS)

    // 页面切到后台尽力补一发：最后一批有可能随标签关闭丢失，属可接受上限
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState == 'hidden') {
            void flush()
        }
    })
})
