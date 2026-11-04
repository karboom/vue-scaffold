import { defineConfig, devices } from '@playwright/test'

// 端口可覆盖：本地 `npm run dev` 常年占着 3173，e2e 换端口跑就不会误测到 dev server
const port = Number(process.env.E2E_PORT ?? 3173)

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  // 服务端是每次新起的 Nitro 进程：默认 8 并发会在冷启动那一刻把首批响应挤出 5s 断言窗口
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Nuxt UI 侧边栏是 lg(1024px) 断点才显示，Desktop Chrome 默认 720 高会压缩布局
        viewport: { width: 1280, height: 800 },
        // 钉住浏览器语言：i18n 会跟随 navigator.language，避免用例随运行环境语言漂移
        locale: 'zh-CN',
      },
    },
    // 多内核覆盖：npx playwright install firefox webkit 后取消注释
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // 被测对象必须是构建产物（Nitro server）：复用已有服务会让 dev server 顶替，测出的结论不可信
  webServer: {
    command: `PORT=${port} npm run preview`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})