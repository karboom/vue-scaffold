/**
 * 包一层 console 再具名导出，而不是让调用点直用 console：
 * 1) 未来要做生产降噪、级别开关（如非 error 不落盘）、日志上报，只改本文件一处；
 * 2) 具名导入可被 IDE 全量检索，"谁在打日志"一目了然；
 * 3) 隔离 console 被三方库 monkey-patch 的风险。
 *
 * 设计目的（error 的异步上报出口）：错误要能离开浏览器被人看见，但本文件必须保持零 import——
 * `utils/http.ts` 已经在 import 本文件，反向去引 `@/api/client` 会成环；更要命的是上报请求
 * 自身失败会再进一次 `log.error`，形成"失败 → 上报 → 再失败"的死循环。
 * 所以这里只留一个可注入的槽位，由宿主插件（src/adapter/plugins/log-report.ts）在启动时接上真实传输；
 * 没注入时 error 路径与改造前完全一致，零额外开销。
 */

/** 一条待上报的错误：details 保留调用点的原始附加参数，序列化口径由上报侧决定 */
export type LogRecord = {
    level: 'error'
    message: string
    details: unknown[]
    /** 发生时刻（epoch ms）：批量上报后只能靠它还原时序 */
    at: number
}

/** 上报器契约：同步入队即可，真正的发送节奏在实现侧 */
export type LogReporter = (record: LogRecord) => void

let reporter: LogReporter | null = null

/** 注入/摘除上报器：传 null 用于测试或运行期关停 */
export const setLogReporter = (next: LogReporter | null) => {
    reporter = next
}

/** 是否有非 error 级别诉求改这里：info/warn/debug 目前只落 console，不占上报带宽 */
export const info = console.info

export const warn = console.warn

export const debug = console.debug

/**
 * error 是唯一进入上报通道的级别：先原样落 console（本地排障第一现场），再交给上报器。
 * 上报器抛错一律就地吞掉转 console.warn——监控组件自身故障绝不允许把业务页面带崩，
 * 也不能让它递归回到本函数（递归熔断在上报侧按 requestId 识别，见 log-report 插件）。
 */
export const error = (message: unknown, ...details: unknown[]) => {
    console.error(message, ...details)
    if (!reporter) {
        return
    }
    try {
        reporter({ level: 'error', message: String(message), details, at: Date.now() })
    } catch (reportError) {
        console.warn('日志上报器异常，已忽略', reportError)
    }
}
