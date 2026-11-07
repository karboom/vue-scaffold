import { expect, test } from '../fixtures'

/**
 * 视觉回归基线：复用功能用例同一套 page.route 桩，数据逐字节固定，
 * 截图差异只可能来自样式/布局变化，不来自数据抖动。
 *
 * 约定：
 * - 每个用例先等"内容锚点"可见（表格行 / 气泡 / 标题），确保异步渲染收口后才拍；
 * - 聊天页额外等主动推送流式收口，动画中间帧绝不进基线；
 * - 基线对 OS 字体渲染敏感：生成与校验须在同一镜像（官方 playwright 镜像）内进行。
 */

const customersRow = {
    list: [
        {
            id: 'c_1',
            name: '张三',
            company: '示例公司',
            level: 'vip',
            phone: '13800000000',
            sessions: 12,
            tickets: 3,
            lastActive: '2026-01-01 10:00:00+0800',
        },
    ],
    total: 1,
    page: 1,
    pageSize: 10,
}

test.describe('视觉回归', () => {
    test('登录页', async ({ page, seed, mockApi }) => {
        await mockApi.auth()
        await seed()
        await page.goto('/login')
        await expect(page.getByPlaceholder('账号')).toBeVisible()
        await expect(page).toHaveScreenshot('login.png')
    })

    test('首页客户列表', async ({ page, seed, mockApi }) => {
        await mockApi.profile()
        await mockApi.customers(customersRow)
        await seed({ token: 'tk_visual' })
        await page.goto('/')
        await expect(page.getByText('张三')).toBeVisible()
        await expect(page).toHaveScreenshot('home-customers.png')
    })

    test('客户详情抽屉', async ({ page, seed, mockApi }) => {
        await mockApi.profile()
        await mockApi.customers(customersRow)
        await mockApi.customerDetail()
        await seed({ token: 'tk_visual' })
        await page.goto('/')
        await expect(page.getByText('张三')).toBeVisible()

        await page.getByRole('button', { name: '详情' }).click()
        const drawer = page.getByRole('dialog')
        // ReadData 进 success 分支才拍：等详情独有字段上屏，而不是抽屉壳子
        await expect(drawer.getByText('演示备注')).toBeVisible()
        await expect(drawer).toHaveScreenshot('customer-detail.png')
    })

    test('聊天页（历史 + 主动推送收口后）', async ({ page, seed, mockApi }) => {
        await mockApi.profile()
        await mockApi.aiSocket()
        await seed({ token: 'tk_visual' })
        await page.goto('/chat')

        await expect(page.getByText('你好，这是 e2e 桩里的助手')).toBeVisible()
        // 主动推送握手后 1.5s 上膛、逐段流完：poll 到完整结尾，杜绝流中间帧
        await expect
            .poll(async () => page.getByText('定时维护').textContent(), { timeout: 15000 })
            .toContain('暂停约 10 分钟')
        await expect(page).toHaveScreenshot('chat.png')
    })

    test('404 页', async ({ page, seed }) => {
        await seed()
        await page.goto('/not-exist')
        await expect(page.getByText('页面不存在')).toBeVisible()
        await expect(page).toHaveScreenshot('not-found.png')
    })
})
