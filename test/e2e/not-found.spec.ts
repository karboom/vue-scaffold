import { expect, test } from './fixtures'

test.describe('404 页面', () => {
    test('未知路径渲染 404，并可返回首页', async ({ page, seed }) => {
        await seed()
        await page.goto('/not-exist')
        await expect(page.getByText('页面不存在')).toBeVisible()
        await expect(page.getByText('404').first()).toBeVisible()
        await expect(page.getByText('/not-exist').first()).toBeVisible()

        await page.getByText('返回首页').click()
        // 点击后 vue-router 跳转是异步的，轮询到 '/' 为止，消除读取竞态
        await expect.poll(async () => page.evaluate(() => location.pathname)).toBe('/')
    })
})
