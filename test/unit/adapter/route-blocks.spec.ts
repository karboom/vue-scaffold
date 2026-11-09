import { describe, expect, it } from 'vitest'

import { parseRouteBlock } from '@/adapter/modules/route-blocks'

/**
 * 钉死 Windows 回归：git autocrlf 检出后 .vue 是 CRLF，行尾 \r 会让
 * `.` 不匹配的键值正则整体失配（曾经直接抛"meta 行无法解析"）。
 * LF / CRLF 必须产出同一个解析结果。
 */
const lines = [
    '<route lang="yaml">',
    'path: /chat',
    'meta:',
    '  titleKey: pages.chat.title',
    '  requiresAuth: false',
    '</route>',
]
const expected = { path: '/chat', meta: { titleKey: 'pages.chat.title', requiresAuth: false } }

describe('route 块解析：行尾兼容', () => {
    it('LF（仓库内格式）', () => {
        expect(parseRouteBlock(lines.join('\n'))).toEqual(expected)
    })

    it('CRLF（Windows 检出）', () => {
        expect(parseRouteBlock(lines.join('\r\n'))).toEqual(expected)
    })

    it('无 route 块返回 null，页面照常走默认路由', () => {
        expect(parseRouteBlock('<template><div /></template>')).toBeNull()
    })
})
