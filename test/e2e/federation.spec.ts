import { expect, test } from './fixtures'

/**
 * 联邦消费链路 e2e：被测对象是真实的 provider 产物（build:mf 快照由 serve-mf.mjs 提供，
 * 宿主经 NUXT_PUBLIC_MF_HOSTS 指向它）。这条用例覆盖的不只是"渲染出来了"，
 * 而是宿主与远程之间最容易出问题的三件事：跨源加载、响应式共享、事件回传。
 */
test.describe('联邦远程组件', () => {
    test('远程 HelloWidget 加载渲染，点击回传宿主 store', async ({ page, seed }) => {
        await seed()
        await page.goto('/federation')

        // 远程 bundle 跨源加载：等骨架让位、远程组件的标题上屏
        await expect(page.getByText('远程组件（HelloWidget）')).toBeVisible({ timeout: 15_000 })

        // 事件回传：点远程项 → 宿主 store.pick → 宿主文案刷新（双向链路都要活着）。
        // 断言原始值而不是显示标签：契约传的是数据，翻译是宿主渲染层的事
        await page.getByText('Alpha（联邦示例项）').click()
        await expect(page.getByTestId('federation-picked')).toContainText('alpha')

        // 远程组件与宿主共享同一 vue 实例：响应式在远程侧生效才算过
        await page.getByText('Beta（联邦示例项）').click()
        await expect(page.getByTestId('federation-picked')).toContainText('beta')
    })

    test('宿主 ssr:true 下远程不进服务端 HTML：首帧源码只有骨架', async ({ page, seed }) => {
        await seed()
        const response = await page.goto('/federation')
        const html = await response!.text()

        // 远程内容绝不允许出现在 SSR HTML 里（出现即说明 ClientOnly 边界被绕过）
        expect(html).not.toContain('联邦示例项')
    })

    test('路由清单直写远程：桩渲染、meta 生效、首帧不含远程内容', async ({ page, seed }) => {
        await seed()
        const response = await page.goto('/remote-about')

        // 首帧 HTML：路由记录是构建期注册的（服务端认识这条路径，不 404），但远程内容不进 SSR
        const html = await response!.text()
        expect(html).not.toContain('AboutCard · 远程提供')

        // 跨源经桩加载：AboutCard 由 remote-routes 清单 + RemotePage 桩带出
        await expect(page.getByRole('heading', { name: 'AboutCard · 远程提供' })).toBeVisible({ timeout: 15_000 })

        // titleKey 走的是宿主路由 meta：app.vue 的 useHead 与守卫消费的正是清单注入的记录
        await expect(page).toHaveTitle('远程页面')
    })
})
