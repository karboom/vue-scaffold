import { defineConfig, devices } from '@playwright/test'

// 端口可覆盖：本地 `npm run dev` 常年占着 3173，e2e 换端口跑就不会误测到 dev server
const port = Number(process.env.E2E_PORT ?? 3173)
// 联邦 provider 静态服务端口：宿主通过 NUXT_PUBLIC_MF_HOSTS 指向它
const mfPort = Number(process.env.E2E_MF_PORT ?? 3177)

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  // 服务端是每次新起的 Nitro 进程：默认 8 并发会在冷启动那一刻把首批响应挤出 5s 断言窗口
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  expect: {
    toHaveScreenshot: {
      // 冻结 CSS 动画/过渡：过渡中间帧进基线必抖
      animations: 'disabled',
      // 输入框光标 530ms 闪一次，落在"亮"还是"灭"纯看时机
      caret: 'hide',
      // 字体抗锯齿级噪声容忍，结构性变化远超这个量
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/visual/**',
      use: {
        ...devices['Desktop Chrome'],
        // Nuxt UI 侧边栏是 lg(1024px) 断点才显示，Desktop Chrome 默认 720 高会压缩布局
        viewport: { width: 1280, height: 800 },
        // 钉住浏览器语言：i18n 会跟随 navigator.language，避免用例随运行环境语言漂移
        locale: 'zh-CN',
      },
    },
    {
      name: 'visual',
      testMatch: '**/visual/**/*.spec.ts',
      // 快照抖动该修稳定性，不该靠重试蒙混——重试通过率一旦掺水，基线就失去意义
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        locale: 'zh-CN',
      },
    },
    // 多内核覆盖：npx playwright install firefox webkit 后取消注释
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // 被测对象必须是构建产物（Nitro server）：复用已有服务会让 dev server 顶替，测出的结论不可信
  // 联邦用例需要两个同源独立的服务：宿主 Nitro + provider 静态产物（见 scripts/serve-mf.mjs）
  webServer: [
    {
      command: `PORT=${mfPort} node scripts/serve-mf.mjs`,
      // 就绪检查必须打真实文件：静态根路径没有 index，404 会把 Playwright 的等待卡到超时
      url: `http://localhost:${mfPort}/_nuxt/remoteEntry.js`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `PORT=${port} NUXT_PUBLIC_MF_HOSTS=vue_scaffold@http://localhost:${mfPort}/_nuxt/remoteEntry.js npm run preview`,
      url: `http://localhost:${port}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})