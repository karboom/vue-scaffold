import { describe, expect, it } from 'vitest'
import { parseDateTime } from '@/utils/time'

/**
 * 解析契约：后端给的是"人眼可读 + 自带偏移"的时间串，形状五花八门。
 * 用例钉的不是 Date 的行为，而是"同一条串在任何宿主上算出同一个时刻"，
 * 所以断言一律用 toISOString（UTC 绝对时刻），不依赖进程时区
 */
describe('后端时间串解析', () => {
    it('带冒号偏移解析成绝对时刻', () => {
        expect(parseDateTime('2026-11-05 14:23:45+08:00')?.toISOString()).toBe('2026-11-05T06:23:45.000Z')
    })

    // 这两写法 new Date() 在 Safari 上是 Invalid Date，正是接真实后端最容易炸的一类
    it('空格分隔与无冒号偏移照样认，T 分隔也认', () => {
        expect(parseDateTime('2026-11-05 14:23:45+0800')?.toISOString()).toBe('2026-11-05T06:23:45.000Z')
        expect(parseDateTime('2026-11-05T14:23:45+0800')?.toISOString()).toBe('2026-11-05T06:23:45.000Z')
    })

    it('Z 按 UTC，负偏移按西时区', () => {
        expect(parseDateTime('2026-11-05 14:23:45Z')?.toISOString()).toBe('2026-11-05T14:23:45.000Z')
        expect(parseDateTime('2026-11-05 09:00:00-0500')?.toISOString()).toBe('2026-11-05T14:00:00.000Z')
    })

    // 缺偏移是最危险的输入：按本地时区解会让 SSR 与浏览器各说一套，这里钉死业务时区
    it('缺偏移按业务时区 +08:00 补齐', () => {
        expect(parseDateTime('2026-11-05 14:23:45')?.toISOString()).toBe('2026-11-05T06:23:45.000Z')
    })

    it('毫秒段按位数补零：.1 是 100ms 不是 1ms', () => {
        expect(parseDateTime('2026-11-05 14:23:45.1+0800')?.getMilliseconds()).toBe(100)
        expect(parseDateTime('2026-11-05 14:23:45.123+0800')?.getMilliseconds()).toBe(123)
    })

    it('空串与形状不符给 null（详情骨架期的空值走这条路，不是异常）', () => {
        expect(parseDateTime('')).toBeNull()
        expect(parseDateTime('now')).toBeNull()
        expect(parseDateTime('2026-11-05')).toBeNull()
        expect(parseDateTime('2026-11-05 25:00:00')).toBeNull()
    })

    // Luxon 判日历（比 Date.UTC 老实：它会把 2 月 30 日顺移成 3 月 2 日且不报错）
    it('形状对但日历不成立的值给 null，不静默顺移', () => {
        expect(parseDateTime('2026-02-30 10:00:00+0800')).toBeNull()
        expect(parseDateTime('2026-13-01 10:00:00+0800')).toBeNull()
    })

    // 形状门禁：库比我们宽松，这两类输入透传给 Luxon 会解出一个"看起来正常"的时刻
    it('偏移越界与不足秒的串给 null', () => {
        expect(parseDateTime('2026-11-05 14:23:45+9999')).toBeNull()
        expect(parseDateTime('2026-11-05 14:23:45+1460')).toBeNull()
        expect(parseDateTime('2026-11-05 14:23')).toBeNull()
    })

    it('只带小时的偏移也按业务时区可读', () => {
        expect(parseDateTime('2026-11-05 14:23:45+08')?.toISOString()).toBe('2026-11-05T06:23:45.000Z')
    })

    it('闰年 2 月 29 日是合法值', () => {
        expect(parseDateTime('2028-02-29 10:00:00+0800')?.toISOString()).toBe('2028-02-29T02:00:00.000Z')
    })
})
