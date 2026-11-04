import { cookieValue, expect, test, type Page } from './fixtures'

/**
 * 多方式登录 e2e：生产构建默认 mock=off，接口全部由 page.route 代答
 */
test.describe('登录页多方式登录', () => {
    test.beforeEach(async ({ seed, mockApi }) => {
        await mockApi.profile()
        await mockApi.customers()
        await mockApi.auth()
        await seed()
    })

    const visitLogin = async (page: Page) => {
        await page.goto('/login')
        // 登录页是独立页面：默认布局的侧边栏不允许出现
        await expect(page.locator('.app-sidebar')).toHaveCount(0)
    }

    const landedOnHome = async (page: Page) => {
        await expect(page.getByText('Vue3 + Vite + Pinia + Nuxt UI 脚手架').first()).toBeVisible()
    }

    const storedToken = async (page: Page) => cookieValue(page, 'token')

    // Nuxt UI Tabs：未激活面板保持挂载但带 hidden，按钮一律锁定 active 面板避免 strict 歧义
    const activePanel = (page: Page) => page.locator('[data-slot="content"][data-state="active"]')

    test('账号密码登录：成功后落 token 并回跳首页', async ({ page }) => {
        await visitLogin(page)

        await page.locator('input[placeholder="账号"]').fill('demo')
        await page.locator('input[placeholder="密码"]').fill('pwd123')

        const loginResponse = page.waitForResponse('**/api/v1/auth/login')
        await activePanel(page).getByRole('button', { name: '登录', exact: true }).click()
        await loginResponse

        await landedOnHome(page)
        expect(await storedToken(page)).toMatch(/^tk_password/)
    })

    test('手机验证码登录：发送后进入倒计时，凭验证码可登录', async ({ page }) => {
        await visitLogin(page)

        await page.getByRole('tab', { name: '手机验证码' }).click()
        await page.locator('input[placeholder="手机号"]').fill('13800000000')

        const smsResponse = page.waitForResponse('**/api/v1/auth/sms-code')
        await activePanel(page).getByRole('button', { name: '获取验证码' }).click()
        await smsResponse

        await expect(activePanel(page).getByRole('button', { name: /秒后重发/ })).toBeDisabled()
        await expect(page.getByText('验证码已发送').first()).toBeVisible()

        await page.locator('input[placeholder="验证码"]').fill('123456')
        const loginResponse = page.waitForResponse('**/api/v1/auth/login')
        await activePanel(page).getByRole('button', { name: '登录', exact: true }).click()
        await loginResponse

        await landedOnHome(page)
        expect(await storedToken(page)).toMatch(/^tk_sms/)
    })

    test('钉钉登录：点击图标直接换 token', async ({ page }) => {
        await visitLogin(page)

        const loginResponse = page.waitForResponse('**/api/v1/auth/login')
        await page.locator('button[title="钉钉登录"]').click()
        await loginResponse

        await landedOnHome(page)
        expect(await storedToken(page)).toMatch(/^tk_dingtalk/)
    })

    test('指纹登录：点击图标直接换 token', async ({ page }) => {
        await visitLogin(page)

        const loginResponse = page.waitForResponse('**/api/v1/auth/login')
        await page.locator('button[title="指纹登录"]').click()
        await loginResponse

        await landedOnHome(page)
        expect(await storedToken(page)).toMatch(/^tk_biometric/)
    })
})
