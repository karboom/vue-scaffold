import { cookieValue, expect, test, type Page } from './fixtures'

test.describe('界面语言', () => {
    const customersOneRow = {
        list: [
            {
                id: 'c_1',
                name: '客户甲',
                company: '公司甲',
                level: 'vip',
                phone: '13800000000',
                sessions: 10,
                tickets: 2,
                lastActive: '2026-10-28 10:00:00+0800',
            },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
    }

    test.beforeEach(async ({ seed, mockApi }) => {
        await mockApi.profile()
        // 列表也自己钉：生产构建默认 mock=off，不拦截就走真实后端拿不到数据
        await mockApi.customers(customersOneRow)
        // 从中文起步：seed 默认落 zh-CN，登录态用 token 模拟
        await seed({ token: 'e2e-token' })
    })

    // 等列表渲染出来再操作，替代原来的 cy.wait('@profile'/'@customers')
    const visitHome = async (page: Page) => {
        await page.goto('/')
        await expect(page.getByText('客户甲')).toBeVisible()
    }

    test('切换英文后文案、标题与 html lang 同步', async ({ page }) => {
        await visitHome(page)
        await expect(page.getByText('Vue3 + Vite + Pinia + Nuxt UI 脚手架').first()).toBeVisible()
        await expect(page.getByText('重新加载')).toBeVisible()

        await page.getByText('English').click()

        await expect(page.getByText('Vue3 + Vite + Pinia + Nuxt UI scaffold').first()).toBeVisible()
        // 表头与按钮文案同样跟随切换（英文值见 locales/en-US.ts）
        await expect(page.getByText('Customer').first()).toBeVisible()
        await expect(page.getByText('Reload')).toBeVisible()
        await expect(page).toHaveTitle('Demo home')
        await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
    })

    test('语言偏好落盘，刷新后仍是英文', async ({ page }) => {
        await visitHome(page)
        await page.getByText('English').click()
        await expect(page.getByText('Vue3 + Vite + Pinia + Nuxt UI scaffold').first()).toBeVisible()

        await page.reload()
        await expect(page.getByText('Vue3 + Vite + Pinia + Nuxt UI scaffold').first()).toBeVisible()

        const stored = await cookieValue(page, 'locale')
        expect(stored).toBe('en-US')
    })
})
