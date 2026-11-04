/**
 * 后端时间串的解析出口：把"时间串"变成能被 i18n 格式化的 Date
 *
 * 分工要说清楚，别以为整件事都交给 Luxon 了：
 * - **算术给 Luxon**：偏移换算、闰年、毫秒位数、非法日历值。这些它比我们可靠——
 *   `Date.UTC` 会把 2 月 30 日顺移成 3 月 2 日且不报错，`new Date('… +0800')` 在 Safari 直接 Invalid Date
 *   （ES 规范只要求引擎认 `YYYY-MM-DDTHH:mm:ss.sssZ`，空格分隔与无冒号偏移靠的是 V8 的宽容解析）。
 * - **形状门禁留在这里**：Luxon 比我们的契约宽松，直接透传会让脏数据变成一个凭空造出来的时刻——
 *   只给日期它会当当地午夜，偏移写成 `+9999` 它也能解出一个时间。这类值必须判 null，让渲染层回落占位符。
 */
import { DateTime } from 'luxon'

/**
 * 业务时区：串里没有偏移时按它解释。
 * 不显式传就跟着系统时区走，Node（常是 UTC）与浏览器会把同一条串读成两个时刻——
 * 与 `datetimeFormats` 钉 `timeZone` 是同一个道理，只是发生在读侧
 */
const BUSINESS_ZONE = 'Asia/Shanghai'

/** 契约形状：日期 + 时分秒，秒不可省（只到分、只到日期的一律按脏值处理） */
const SHAPE_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/

/** 偏移必须在 ±14:00 内、分钟必须小于 60，否则是形如 +9999 的脏值 */
const OFFSET_RE = /[+-](\d{2}):?(\d{2})$/

const hasSaneOffset = (value: string): boolean => {
    const matched = OFFSET_RE.exec(value)
    if (!matched) {
        // 不带偏移或只带小时（+08）：由 BUSINESS_ZONE 兜底，没有数值要判
        return true
    }
    return Number(matched[1]!) <= 14 && Number(matched[2]!) < 60
}

/**
 * 时间串 → Date；空串（详情骨架期的合法值）或形状不符给 null，由渲染层回落占位符。
 * 不抛错也不打日志：时间只是展示字段，一条脏值不该打挂整张表，更不该在每格渲染时刷一次控制台
 */
export const parseDateTime = (value: string): Date | null => {
    if (!SHAPE_RE.test(value) || !hasSaneOffset(value)) {
        return null
    }

    // fromSQL 认后端主形状（空格分隔），带 T 的 ISO 交给 fromISO——两种都可能来自明天的后端
    const fromSql = DateTime.fromSQL(value, { zone: BUSINESS_ZONE })
    const at = fromSql.isValid ? fromSql : DateTime.fromISO(value, { zone: BUSINESS_ZONE })

    return at.isValid ? at.toJSDate() : null
}
