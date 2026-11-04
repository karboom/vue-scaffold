import { expect, test } from './fixtures'

// i18n 跟随浏览器语言，config 已把 context locale 钉为 zh-CN，seed 再落 cookie 双保险
test.describe('脚手架首页', () => {
    test('渲染布局与示例卡片', async ({ page, seed }) => {
        await seed()
        await page.goto('/')
        await expect(page.getByText('Vue3 + Vite + Pinia + Nuxt UI 脚手架').first()).toBeVisible()
        // 默认布局生效：侧边栏应存在（与登录页的 layout:false 形成对照断言）
        await expect(page.locator('.app-sidebar')).toBeVisible()
    })

    // action 四件套链路：Button 触点 → Detail 抽屉 → 抽屉内 ReadData 四态 → Confirm 动作区保存
    test('详情抽屉：打开、渲染详情、改等级保存后收起', async ({ page, seed, mockApi }) => {
        await seed()
        await mockApi.customers({
            list: [
                {
                    id: 'c_1',
                    name: '张三',
                    company: '示例公司',
                    level: 'vip',
                    phone: '13800000000',
                    sessions: 12,
                    tickets: 3,
                    lastActive: '2026-01-01 10:00:00',
                },
            ],
            total: 1,
            page: 1,
            pageSize: 10,
        })
        await mockApi.customerDetail()
        await page.goto('/')

        await page.getByRole('button', { name: '详情' }).click()

        const drawer = page.getByRole('dialog')
        await expect(drawer.getByText('客户详情')).toBeVisible()
        // ReadData 已进 success 分支：详情独有的字段与标签都上了屏
        await expect(drawer.getByText('重点客户')).toBeVisible()
        await expect(drawer.getByText('演示备注')).toBeVisible()

        // 改等级 → 保存：updateCustomer 成功后抽屉自动收起并重拉列表
        // 选项面板挂在 body 的 portal 上，不在 dialog 子树里，只能从 page 取
        await drawer.getByRole('combobox').click()
        await page.getByRole('option', { name: 'svip' }).click()
        const saved = page.waitForResponse(
            resp => resp.request().method() == 'PUT' && resp.url().includes('/api/v1/customers/'),
        )
        await drawer.getByRole('button', { name: '保存' }).click()
        await expect(saved).resolves.toBeTruthy()
        await expect(page.getByRole('button', { name: '详情' })).toBeVisible()
    })

    // 样式管线冒烟：main.css 没被 css:[] 引用时页面照样"能看见"，但 Tailwind 全部失效
    test('Tailwind 与 Nuxt UI 样式已生效', async ({ page, seed }) => {
        await seed()
        await page.goto('/')

        const cardMaxWidth = await page
            .locator('[class*="max-w-"]')
            .first()
            .evaluate(el => getComputedStyle(el).maxWidth)
        expect(cardMaxWidth).toBe('720px')

        const sidebarWidth = await page.locator('.app-sidebar').evaluate(el => getComputedStyle(el).width)
        expect(sidebarWidth).not.toBe('auto')
    })
})
