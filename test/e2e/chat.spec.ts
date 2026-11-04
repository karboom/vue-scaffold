import { expect, test } from './fixtures'

/**
 * AI 聊天 e2e：双壳共用。
 * 生产构建 mock=off 走的是真 socket.io 实现，服务端由 fixtures 的 routeWebSocket 桩扮演，
 * 协议与 mock 替身逐字节同构（信封 msgId 配对 + start/delta/done 流式）
 */
test.describe('AI 聊天页', () => {
    test.beforeEach(async ({ seed, mockApi }) => {
        // 布局会拉 profile：不桩的话 SPA 兜底会把 HTML 当 JSON 喂进渲染链
        await mockApi.profile()
        await mockApi.aiSocket()
        await seed({ token: 'tk_chat' })
    })

    test('历史经信封 ack 上屏，回车发送后收到流式回复', async ({ page }) => {
        await page.goto('/chat')

        // 历史 ack 成功：ReadData 进 success 分支，种子气泡可见
        await expect(page.getByText('你好，这是 e2e 桩里的助手')).toBeVisible()

        // 主动推送：桩在服务端握手后 1.5s 自发起，用户此刻什么都还没发
        await expect
            .poll(async () => page.getByText('定时维护').textContent(), { timeout: 15000 })
            .toContain('暂停约 10 分钟')

        await page.getByPlaceholder('给 AI 发消息，回车发送').fill('你好AI')
        // canSend = 输入非空 && 无在途回复：填好输入后按钮可用即代表主动推送已收口，
        // 否则 send 的 streaming 守卫会吞掉紧接着的回车
        await expect(page.getByRole('button', { name: '发送' })).toBeEnabled()
        await page.keyboard.press('Enter')

        // 用户气泡 fire-and-forget 立即收口
        await expect(page.getByText('你好AI', { exact: true })).toBeVisible()

        // 流式收口：末段到达才出现完整结尾
        await expect
            .poll(async () => page.getByText('e2e 罐头回复').textContent(), { timeout: 15000 })
            .toContain('协议与 mock 替身完全一致')
    })
})
