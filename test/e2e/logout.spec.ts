import { cookieValue, expect, test } from './fixtures'

test.describe('退出登录', () => {
    test('退出后跳转登录页并清空 token', async ({ page, seed, mockApi }) => {
        await mockApi.profile()
        await seed({ token: 'e2e-token' })
        await page.goto('/')

        // 触发器是头像+姓名拼出来的 button，用 role+正则锁它；弹层项是标准 menuitem
        await page.getByRole('button', { name: /演示用户/ }).click()
        await page.getByRole('menuitem', { name: '退出登录' }).click()

        // router.replace 是异步的，轮询 pathname 替代 Cypress 的自动重试
        await expect.poll(async () => page.evaluate(() => location.pathname)).toBe('/login')
        const token = await cookieValue(page, 'token')
        expect(token).toBeNull()
    })
})
