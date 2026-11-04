# vue-scaffold

[![Node][shield-node]][engines] [![Vue 3.5][shield-vue]][vue] [![TypeScript 5.9][shield-ts]][ts] [![Vite 8][shield-vite]][vite] [![Nuxt 4.6][shield-nuxt]][nuxt] [![LLM Review][shield-review]][llm-review]

**Vue 3 + Nuxt 4 + Pinia + Nuxt UI 的中后台脚手架**：单宿主 Nuxt，`src/` 一个目录装下页面、组件、store 与 API；交互收敛为 `action/*` 组件；约定、类型合约与 mock 运行时对 AI Agent 开箱友好。

- 🧩 **action/\* 交互封装** —— 一类交互只做对一次，页面模板约为散写写法的 1/3
- 🏗 **一套代码两种渲染** —— 默认 `ssr: true`（首屏 SSR + 站内 CSR）；纯后台项目翻 `ssr: false` 即退回 SPA，页面写法不变
- 🤖 **AI 友好性** —— 规则文件可直接喂给 Agent，类型让错误编译即爆，mock 让全站无需后端可跑
- 🔄 **IOCtx 状态机** —— `status × hasLoaded` 两个正交维度把请求状态收敛为 7 种有确定 UI 语义的组合，竞态保护与失败保旧数据内聚在 `run()` 里

## 目录

- [Why：四大支柱](#why四大支柱)
- [快速开始](#快速开始)
- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [核心概念](#核心概念)
- [国际化](#国际化i18n)
- [API 层](#api-层)
- [HTTP 能力](#http-能力)
- [WebSocket 能力](#websocket-能力)
- [日志与错误上报](#日志与错误上报)
- [渲染模式与 SSR](#渲染模式与-ssr)
- [测试](#测试)
- [脚本与环境变量](#脚本与环境变量)
- [构建与部署](#构建与部署)
- [贡献约定](#贡献约定)
- [已知边界](#已知边界)
- [LLM 评审](#llm-评审)

## Why：四大支柱

### 🧩 action/\*：把交互收进组件

`src/components/action/*` 收录"一类交互一个组件"的封装：`ReadData`（IOCtx 四态渲染容器）、`Detail`（抽屉 v-model 桥接）、`Confirm` / `Button`（动效与触点封装）。以 `ReadData` 为例，页面只提供两件事——success 插槽 + retry 绑定：

```html
<ReadData :io="remote.listIo" @retry="indexPage.fetchList()">
  <template #default="{ data }">
    <UTable :data="data.list" :columns="columns" />
  </template>
</ReadData>
```

骨架、取消、错误、空态、刷新进度条全部由组件接管（空态经 lodash `isEmpty` 按数据形态自动推导，无需传参）。

**换来的东西（评审 PR 时按此对照）：**

| 收益 | 机制 |
|---|---|
| 全站一致性有物理载体 | 契约是"表现形式统一固定，不开放插槽与样式类 prop"；改一处 = 全站数据区生效 |
| 页面只表达意图 | `loading/refreshing/error/canceled` 的组合分支不再出现在业务模板里 |
| 错误处理只正确一次 | axios `code → i18n key` 映射（`codeKeyMap`）收敛在组件内；曾因按 `error.message` 关键字匹配在英文环境翻车，教训已固化为代码 |
| 可观测性自带且防刷屏 | 内置 mount/卸载/重试日志；写在 `watch(io.error)` 而非 computed（computed 每渲染求值会刷日志，此坑已注释留档） |
| 测试杠杆 | 四态分支在组件测试里穷举一次；一个页面用例即覆盖全站数据区 |
| 宿主无关 | 契约只有 props（`io`）与 emits（`retry`），不 import store、不摸浏览器全局，SSR 零风险 |
| 演进锚点 | 新增强状态（限流提示、离线兜底）只改 `ReadData` 一处，调用方免费获得 |

`Detail` 同理：把 `USlideover` 的 `open` 双向同步成标准 `v-model`，页面写 `v-model="local.detailOpen"` 即可，动画与卸载释放由组件生命周期兜底。

首页（`src/pages/index`）即四件套的示例消费方：表格操作列的 `Button` 触点 → `Detail` 抽屉 → 抽屉里再套一层 `ReadData`（详情同样有四态）→ `Confirm` 动作区里改等级并 `updateCustomer`。新增页面时照抄这条链路即可，不要让 `action/*` 只停在"有组件、没人用"。

### 🏗 单宿主 + 能力契约

```text
                 src/  （页面 / 组件 / store / api / i18n / utils + 壳层接线）
                   │
                   │  宿主能力只有一个出口：@/platform
                   │  契约 + 浏览器默认实现 src/adapter/platform.ts（单测直接用）
                   │  Nuxt 实现 src/adapter/plugins/platform.ts（启动时 installPlatform 替换）
                   ▼
              Nuxt 4.6（默认 ssr:true，可整站或按路由关闭 SSR）
```

- `src/adapter/platform.ts` 同时是**契约与浏览器默认实现**：单测走它，不需要启动 Nuxt 运行时；Nuxt 侧只在 `src/adapter/plugins/platform.ts` 里安装一份 cookie / 请求头实现，替换 `preferredLanguage` / `isClient` / `isDev`。
- `platform` 出口对象不变，`installPlatform` 只换内部实现，所以模块导入期拿到的 `platform.storage` 引用不会失效。
- 渲染模式是一个开关：`ssr: true`（默认）→ 首屏 SSR + 站内 CSR；`ssr: false` → 纯客户端渲染。两者共用同一批页面与 e2e，切换只影响首屏有没有 HTML。

### 🤖 AI 友好性

让大模型（和新人）能安全改这个仓库的设计：

| 机制 | 位置 | 效果 |
|---|---|---|
| 规则即文件 | `.aider-desk/rules/custom.md` | 驼峰命名、store 工厂写法、`local/remote` 分区、生命周期 region 标记等约定可直接注入 Agent 上下文 |
| 技能即手册 | `.agents/skills/vue-scaffold` | 约定全文放这一份，按需加载不常驻上下文；各家扫描路径（`.aider-desk/skills` 等）需手工软链过来（见目录结构一节） |
| 约定即规则 | `eslint.config.mjs` 的 `app/*-conventions` | 能静态判定的约定（State 用 type、store 工厂、`*Io` 命名、mock 必须引用 real、禁写死 delay…）直接用 `no-restricted-syntax` 选择器拦，`npm run lint` 即闸门，不另养校验脚本 |
| 类型即合约 | `MessageSchema` / `typeof Real.fn` | 词典缺 key、mock 签名漂移 → 编译期报错，反馈回路不靠人 |
| mock 即运行时 | `src/api/mock/*` + `VITE_API_MOCK` | 无后端可跑全站、可演示；`respond` 支持 `delay` / `fail` 模拟任意状态 |
| 验证即反馈 | `typecheck` / `lint` / 单测 / e2e | Agent 改完可自证，不需要人类环境 |
| 单一真源 | `sessionStore.local.locale`、`zh-CN.ts` | 每个概念只有一处可写，减少 Agent 幻觉出的旁路 |
| 教训入代码 | 组件内注释（如 `hasLoaded` 正交性） | "为什么"留在原地，而非散落的聊天记录 |

> 想先看结论？[LLM 评审打分（docs/llm-review.md）](docs/llm-review.md) 用一份可复现的 prompt 对上述特征逐维度打分。

### 🔄 IOCtx：把请求状态建模成正交两维

常见做法是一维 status 枚举再加布尔位（`refreshing`、`firstLoad`……）拼接状态，组合一多语义就漂移：`error` 时旧数据还在不在？`loading` 该画骨架还是进度条？

`src/utils/io.ts` 只用两个**正交**字段，把全部组合收敛为 7 种有确定 UI 语义的状态：

- `status` 只表达"当前"：`loading | success | error | canceled`；
- `hasLoaded` 只记录"历史"：是否曾经成功加载过。

正交性写在字段注释里：**二者不可互相推导**——error 之后再拉，仍要靠 `hasLoaded` 区分首载骨架还是后台刷新。`refreshing` 不存储、只派生（`status == 'loading' && hasLoaded`），从根上消灭了两个字段各写各的导致漂移的那类 bug。

竞态与边界全部内聚在 `run(executor)` 里，调用方拿不到"半更新"的状态：

- 自动 `abort` 上一次请求，过期结果不会覆盖新请求；
- 失败保留旧 `data`——error + 已加载 = 旧内容 + 错误提示，而不是白屏；
- 取消语义分叉：刷新取消回 `success`，首载取消才进 `canceled`。

与 `action/ReadData` 的分工是：**状态机负责"是什么"（7 种组合），组件负责"怎么显示"（骨架/空态/进度条/错误页）**，页面模板里因此可以零状态分支。完整组合表与实现见 [核心概念 · IOCtx 请求状态机](#ioctx-请求状态机)。

## 快速开始

要求 Node 24+（版本见 `package.json` 的 `engines`，Docker 构建使用 `node:24`）。

```bash
npm ci             # postinstall 会跑 nuxt prepare，生成 .nuxt 类型
npm run dev        # :3173，默认加载 .env.development，走 mock
```

静态构建与本地预览：

```bash
npm run build      # Nitro 服务端产物 → .output/
npm run preview    # :3173，直接跑 node .output/server/index.mjs
```

想走纯静态托管（SSG）时用 `npm run generate`（产物 `.output/public/`），本地验证直接起静态形态的运行镜像（`docker build -f deploy/Dockerfile --target runtime .` 后 `docker run -p 3173:80`），它跑的就是线上那份 `deploy/nginx.conf`，回退语义不必另配。

## 技术栈

| 分类 | 选型 |
|---|---|
| 框架 | Vue 3.5、Nuxt 4.6（内置 Vue Router）、Pinia 4 |
| UI | Nuxt UI 4（Tailwind CSS 4 + Reka UI）+ Iconify lucide 图标（构建期内联）；样式入口 `src/main.css`，由 `nuxt.config` 的 `css: []` 引用，缺它则全站无样式 |
| 表格 / 校验 | @tanstack/vue-table（`UTable` 列定义 `ColumnDef`）、Valibot（`UForm` standard-schema 校验，错误文案走 i18n） |
| 构建 | Vite 8、TypeScript 5.9、Vue TSC |
| 请求 | axios、socket.io-client |
| 国际化 | vue-i18n 11（Composition API，`legacy: false`） |
| 测试 | Vitest、Playwright |
| Mock | mockjs（通过构建期 alias 注入） |

内置能力：文件路由、布局、404 兜底、组件自动注册；zh-CN / en-US 双语、语言偏好落盘、标题与 `<html lang>` 跟随切换；real / mock 双实现无感切换；工厂化 HTTP 实例（401、遥测、requestId、幂等键）；多阶段 Dockerfile + OSS/CDN 发布脚本。

## 目录结构

```text
nuxt.config.ts             # 唯一入口：ssr / css / alias / dir / components
vitest.config.ts           # 单测：alias 与 Nuxt 对齐；@/platform → adapter/platform.ts
env.d.ts                   # ImportMetaEnv 与 RouteMeta 声明
eslint.config.mjs          # 规则只管对错（禁业务直连 mock 等），格式全让位给 prettier
.prettierrc.json           # 格式真源：.ts 缩进 4 / .vue 缩进 2，无分号、单引号、箭头函数省括号

src/                       # srcDir：页面、组件、store、api、适配层都在这里
├─ app.vue                 # 根组件：UApp + NuxtLayout + useHead（title / html lang）
├─ main.css                # Tailwind v4 + Nuxt UI 主题入口（nuxt.config 的 css:[] 引用）
├─ assets/                 # logo.svg（布局 header 引用）
├─ api/
│  ├─ client.ts            # 应用级 HTTP 实例 + AI 聊天专用 socket 实例（@/api/client）
│  ├─ types/*.ts           # 仅类型，real/mock 共用
│  ├─ real/*.ts            # 真实接口实现
│  └─ mock/*.ts            # 与 real 同签名的 mock
├─ i18n/
│  ├─ index.ts             # 装配：首帧语言、实例、语言执行器
│  └─ locales/             # zh-CN.ts 唯一文案源 + 类型源；en-US.ts key 对齐由类型保证
├─ components/
│  ├─ action/              # ReadData / Detail / Confirm / Button：交互封装
│  └─ layouts/             # default.vue + 布局 store
├─ pages/
│  ├─ index/  login/  chat/  # 页面 + 同名 store.ts（chat 为 websocket 示例消费方）
│  └─ [...path].vue        # 404 兜底页
├─ adapter/                # 适配层：宿主能力 + Nuxt 接线，业务代码不混入
│  ├─ platform.ts          # 宿主能力契约 + 浏览器默认实现（@/platform 指向这里，单测直接用）
│  ├─ plugins/             # platform 宿主实现安装 / http 拦截接线 / i18n 挂载 / 全局异常收口 / error 日志上报
│  ├─ middleware/          # auth.global.ts：requiresAuth 守卫
│  └─ modules/             # route-blocks.ts：<route> 块桥接 + 过滤 store.ts 野路由
├─ utils/                  # io.ts / http.ts / websocket.ts / mock.ts / data.ts / log.ts / browser.ts
└─ store.ts                # 全局 session store（token + 语言真源 locale）

public/                    # 原样拷贝到产物根目录（favicon 等）
.agents/skills/            # 跨 agent 的 skills 真源（add-page：SKILL.md + references + templates + 自检脚本）
.aider-desk/rules/         # 常驻规则；skills 需手工软链：ln -s ../.agents/skills .aider-desk/skills
test/unit/**/*.spec.ts     # Vitest
test/e2e/                  # Playwright：fixtures.ts + *.spec.ts
docs/llm-review.md         # LLM 评审打分（可复现 prompt）
deploy/                    # 发布脚本 + Dockerfile（静态）/ ssr.Dockerfile（SSR）+ nginx 托管配置
```

## 核心概念

### Store 约定

- 工厂方法：`xxxStore(id)()`，每个页面/布局独立实例。
- State 固定分为 `local`（渲染相关）与 `remote`（远程数据）。
- 不写 1:1 的 getter；只有真正的派生值才放 `getters`。
- 组件用 `storeToRefs` 解构 `local` / `remote`，不直接解构 store。
- 页面卸载时调用 `$dispose()`。
- 生命周期统一放 script 底部，用 `// region 生命周期` 标记。

```ts
const indexPage = indexStore('index')()
const { local, remote } = storeToRefs(indexPage)
```

### IOCtx 请求状态机

`src/utils/io.ts` 用两个**正交**维度描述一次数据请求：

- `status`：`loading | success | error | canceled`（当前）
- `hasLoaded`：是否曾经成功加载过（历史）

| status | hasLoaded | 含义 | UI |
|---|---|---|---|
| loading | false | 首载进行/未开始 | 骨架 |
| loading | true | 再次加载进行 | 旧内容 + 进度条 |
| success | true | 已加载 | 内容 / 空态 |
| error | false | 首载失败 | 错误页 + 重试 |
| error | true | 再次加载失败 | 旧内容 + 错误提示 |
| canceled | false | 首载取消 | 已取消 + 重试 |

`refreshing` 是派生值：`status == 'loading' && hasLoaded`。

```ts
export class IOCtx<T> {
    status: IOStatus = 'loading'
    hasLoaded = false
    error?: Error
    data: T
    controller = new AbortController()

    get refreshing() { return this.status == 'loading' && this.hasLoaded }

    async run(executor: (io: IOCtx<T>) => Promise<T>) {
        // abort 上一次请求；过期结果不会覆盖新请求；
        // 失败保留旧 data；刷新取消回 success，首载取消进 canceled
    }
}
```

`IOCtx` 与上表的 UI 组合，就是 `action/ReadData` 的实现基础——状态机负责"是什么"，组件负责"怎么显示"。

## 国际化（i18n）

`src/i18n` 只有三个角色：**locales 给内容，index 给实例，`t` 是出口**。

| 文件 | 职责 |
|---|---|
| `index.ts` | 判定首帧语言（`resolveInitialLocale`）、实例工厂（`createAppI18n`，被 `src/adapter/plugins/i18n.ts` 每请求调用）、落盘（`persistLocale`）、`localeOptions` |
| `locales/zh-CN.ts` | 中文词典，同时派生 `MessageSchema`（唯一文案源） |
| `locales/en-US.ts` | 英文词典，标注为 `MessageSchema`，缺/多 key 直接编译报错 |

```ts
// 结构由 zh-CN 派生，其他语言漏 key 会编译报错
type DeepString<T> = {
    [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>
}
export type MessageSchema = DeepString<typeof zhCN>
```

**约定：**

- 语言优先级：已保存偏好 > 浏览器语言（`en*` → `en-US`）> `zh-CN`；落盘键 `locale`。
- 组件里 `const { t } = useI18n()`；组件外（守卫、store）用 `i18n.global.t`。
- **语言真源是 `sessionStore.local.locale`**：写入只有一个入口 `session.setLocale(locale)`，只改 store；i18n 实例、存储落盘（`persistLocale` → `platform.storage`）、DOM 由壳层 watcher 被动跟随。绕过 watcher 直接改 i18n 实例的 locale 会让 store 与实例漂移。
- **首帧与真源同源**：store 初始值与插件的 `createAppI18n(resolveInitialLocale())` 都走 `resolveInitialLocale`（落盘偏好 > 宿主首选语言），服务端首帧、水合与 watcher `immediate` 灌入因此不闪烁；i18n 实例是每请求工厂产物（见 SSR 适配表 #2），不是模块级单例。
- **存 key 不存译文**：`MenuItem.labelKey`、`RouteMeta.titleKey`、错误码 Map 的 value 都是 key。把 `t()` 的结果塞进 state/ref，切语言就不会刷新——`default.vue` 的 `profileItems` 必须是 `computed`。
- **扇出点只有一个**（`src/app.vue`）：DOM 副作用交给 `useHead` 声明式驱动，核心不摸 `document`。

```ts
const { t, te, locale: i18nLocale } = useI18n()

useHead({
    title: pageTitle,                                  // route.meta.titleKey → t()
    htmlAttrs: { lang: computed(() => local.value.locale) },
})
watch(() => local.value.locale, (locale) => {
    i18nLocale.value = locale                          // useI18n() 的 locale 即全局 composer
    persistLocale(locale)                              // 只写存储，不碰实例
}, { immediate: true })
```

- **标题回落**：`pageTitle` 先 `te(titleKey)`，命不中就用 `common.appName`，不会把 `pages.xxx.title` 甩到浏览器标签上。
- **不翻译的内容**：开发日志（`log.*` 保持中文）、后端原始 message（按错误码映射到 `error.*`）、语言自称（`中文` / `English` 各用本身书写）、接口与 mock 返回的业务数据。
- 词典只做 key 对齐，不给 `t()` 加字面量泛型：路由 `meta.titleKey`、错误码映射都是运行期字符串，严格泛型只会逼出大量断言。

<details>
<summary>新增一种语言（3 步）</summary>

1. `LOCALES` 加字面量，`localeOptions` 加该语言的自称。
2. 复制 `locales/en-US.ts` 为 `locales/<locale>.ts`，按 `MessageSchema` 补全（编译器会列出缺哪些 key）。
3. 在 `messages` 里注册该词典。

</details>

## API 层

### 两个概念

- `src/utils/http.ts`：纯基础设施，导出 `createHttp`，不创建实例、不读环境变量。
- `src/api/client.ts`：应用默认实例，`baseURL` 来自 `VITE_API_BASE`。

需要第二个后端/租户时：

```ts
import { createHttp } from '@/utils/http'

const uploadHttp = createHttp({
    baseURL: 'https://upload.example.com',
    timeout: 30000,
    slowRequestMs: 3000,
})
```

### real / mock 无感切换

`nuxt.config.ts` 与 `vitest.config.ts` 中的 alias 顺序很关键（Nuxt 侧的键序不可靠，由 `src/adapter/modules/route-blocks` 重排）：

| alias | 指向 |
|---|---|
| `@/api/client` | `src/api/client.ts`（固定，不参与 real/mock 切换） |
| `@/api/types/*` | `src/api/types/*`（固定） |
| `@/api/*` | `VITE_API_MOCK=on` 时 `src/api/mock/*`，否则 `src/api/real/*` |
| `@/*` | `src/*` |

业务代码统一从领域入口导入，不要直接 import `@/api/real/*` 或 `@/api/mock/*`（ESLint 已禁止 mock 直连）：

```ts
import { fetchCustomerList, type CustomerListResult } from '@/api/customer'
```

### 新增一个接口域

1. `src/api/types/<domain>.ts`：只放类型。
2. `src/api/real/<domain>.ts`：真实实现，使用 `http.get/post/put/del`。
3. `src/api/mock/<domain>.ts`：用 `typeof Real.fn` 锁定签名，并通过 `export type * from '../types/<domain>'` 透出类型。
4. store 里通过 `@/api/<domain>` 使用。

```ts
// src/api/real/customer.ts
import { http } from '@/api/client'
import type { IOCtx } from '@/utils/io'

export type * from '../types/customer'

export const fetchCustomerList = (
    io: IOCtx<CustomerListResult>,
    params: CustomerListParams,
) => http.get(io, { url: '/api/v1/customers', params }).then(res => res.data)
```

```ts
// src/api/mock/customer.ts
import type * as Real from '../real/customer'

export const fetchCustomerList: typeof Real.fetchCustomerList = (io, params) =>
    respond(io, makePage(params.page, params.pageSize), { delay: 200 })
```

`respond` 支持 `delay` 和 `fail`，用于模拟 loading 与错误态。`@/api/types/*` 是固定 alias，始终指向 `src/api/types`，不参与切换，因此不需要 `src/api/mock/types` 目录。

## HTTP 能力

### 实例

```ts
const http = createHttp({
    baseURL: import.meta.env.VITE_API_BASE,
    timeout: 10000,
    slowRequestMs: 1000,
    onTelemetry: event => report(event),
})
// 返回：http.get / post / put / del
//      http.addReqHandler / addResHandler
//      http.handleRequest / handleResponse / handleResponseError
```

<details>
<summary>请求前注入 / 响应处理 / 遥测</summary>

**请求前注入**（支持异步 handler，按注册顺序串行执行，返回卸载函数）：

```ts
const off = http.addReqHandler(config => {
    const token = session.local.token
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
})
```

- 自动注入 `X-Request-Id`，便于前后端排障；
- POST 自动生成 `Idempotency-Key`（调用方已传则不覆盖）；
- token 注入与 401 处理由 `src/adapter/plugins/http.ts` 注册；`src/utils/http.ts` 本身不依赖 store/router。

**响应处理**：

```ts
http.addResHandler(error => {
    if (!isAxiosError(error) || error.response?.status != 401) return
    // 清 token + 跳登录
})
```

- handler 串行执行；handler 自身抛错会中断后续 handler 并替代原始请求错误，业务 handler 应自行捕获异常；
- 401 由应用层处理，`utils/http.ts` 不参与跳转。

**遥测**（成功/失败/取消都上报；回调抛错不影响业务请求）：

```ts
type HttpTelemetry = {
    requestId: string
    method: string
    url: string
    status: number | string
    duration: number
    slow: boolean
    error?: unknown
}
```

超过 `slowRequestMs` 记一条 `HTTP 慢请求` warn；失败记 `HTTP 请求失败` error。

</details>

## WebSocket 能力

### 实例工厂

`src/utils/websocket.ts` 导出 `createSocket`，与 `createHttp` 同构：每实例自持连接、订阅表与 msgId 配对队列，懒建连（首帧/登录页/单测不握手）。应用级实例集中在 `@/api/client`：

```ts
// src/api/client.ts
export const aiSocket = createSocket({
    url: `${import.meta.env.VITE_WS_URL}/ai`,      // pathname 即命名空间
    token: () => sessionStore('app')().local.token, // 惰性取凭证，重连也拿当下最新
    ackTimeout: 15000,
})
```

### 两套协议姿势

| 协议 | 发送 | 应答/推送 | 配对方式 |
|---|---|---|---|
| 裸协议 | `emit` / `emitAck` | `listen` | socket.io 自带 ack |
| 信封协议 | `emitCustom` / `emitCustomAck` | `listenCustom` | 业务报文回带同一 `msgId` |

信封协议是 AI 聊天页（`src/pages/chat/`）所用的示例正文：历史 = `emitCustomAck`（msgId 配对应答，IOCtx 四态），发送 = `emitCustom`（fire-and-forget），回复 = `listenCustom`（服务端 `start/delta/done` 流式推送）。**`emitCustomAck`/`emitAck` 内部已 `ctx.run()`，域函数直接 await，store 侧绝不再包一层 run**——否则内外两层互相 abort。

推送**不必等待发送**：服务端主动发起的消息复用同一条 `start/delta/done` 管道，客户端零改动——mock 域替身在首个订阅者就位后 2~3s 自动开口，e2e 协议桩在命名空间握手后 1.5s 推一条。`loadHistory` 播种按 id **合并**而非覆盖，保证主动推送先于历史 ack 上屏时，在途流式气泡不被抹掉。

### mock：只有域层这一层

与 HTTP 域同一纪律：mock 只替换 `@/api/*` 域实现，**传输层不换**（历史上的 `mock/websocket.ts` 传输替身已删——域替身全包假象后它是重复的第三层，且 HTTP 从来也没有传输替身，双标）：

| | real | mock |
|---|---|---|
| 域 | `src/api/real/chat.ts` 走 `aiSocket` | `src/api/mock/chat.ts` 本地定时器流式，不碰 socket |

代价如实记账：① `socket.io-client` 随 `client.ts` 进所有模式 bundle（mock 构建 +~13KB gzip，dev-only 影响）；② mock=on 下**直接调用 `aiSocket` 会真实建连**——保险丝没了，靠"假象收敛在域替身"的约定与 review 兜底；③ 传输行为本身的可测性不靠 mock，靠下面 e2e 的协议桩。

`mock/chat.ts` 用随机 0-1s"思考"延迟 + 2~6 字/30-90ms 逐段推送，复刻真实推理节奏，store 与页面零感知。

### e2e 与协议桩

生产构建默认 `mock=off`，走真 socket.io 实现——**信封协议在 e2e 里被真实传输**：服务端由 `test/e2e/fixtures.ts` 的 `routeWebSocket` 桩扮演，手动应答 Engine.IO v4 + Socket.IO 握手（`/socket.io/` path + `/user/ai` 命名空间帧），按协议回 ack 与流式片段。

## 日志与错误上报

`src/utils/log.ts` 是全站唯一的日志出口（`import * as log from '@/utils/log'`，不解构）。它自身**零 import**：`utils/http` 已经在 import 它，反向去引 `@/api/client` 会成环，而且上报请求失败会再进 `log.error`，形成"失败 → 上报 → 再失败"的死循环。

所以 error 的异步上报走**注入槽**：

```ts
// src/utils/log.ts：只有 error 进上报通道
export type LogRecord = { level: 'error'; message: string; details: unknown[]; at: number }
export const setLogReporter = (next: LogReporter | null) => { ... }   // 未注入 = 零开销
```

`src/adapter/plugins/log-report.ts` 在客户端启动时把槽位接到 `@/api/client` 的 `http` 实例上，于是 `baseURL`（SSR 侧补绝对 origin）、`Authorization`、`X-Request-Id` 与遥测全都与业务请求同链路。上报侧的四条纪律：

| 机制 | 取值 | 目的 |
|---|---|---|
| 批量 | 攒 20 条或每 2s 发一次 | 连环报错不打成散弹 |
| 队列上限 | 200 条，超出丢最老 | 日志不许吃内存 |
| 递归熔断 | 上报请求自带 `X-Request-Id`，入队时按该 id 丢弃自己的失败回声 | 精确熔断，不误杀同期真错误 |
| 降速静默 | 连续失败 3 次后静默 60s | 日志后端宕机不持续吃用户带宽 |

`VITE_LOG_REPORT_URL` 留空即整个通道不安装（dev 默认空）。上报器内部异常一律转 `console.warn`，绝不影响业务；服务端不装 reporter（日志本就进 stdout），也避免"每请求一个计时器"的泄漏。

## 渲染模式与 SSR

默认 `ssr: true`：首屏由 Node 渲染，站内跳转仍是纯客户端。可以按路由收窄：

```ts
// 整站关掉（纯后台项目的常见选择）
ssr: false

// 或只让公开页 SSR，重交互页保持 CSR
routeRules: {
  '/': { ssr: true },
  '/login': { ssr: true },
  '/chat': { ssr: false },
}
```

### 已经内置的 SSR 适配

这五处是"能开 SSR"的必要条件，脚手架已按 SSR-ready 实现，切换开关不需要再改：

| # | 位置 | 做法 |
|---|---|---|
| 1 | `src/adapter/platform.ts` + `src/adapter/plugins/platform.ts` | 契约 + 浏览器默认实现常驻；Nuxt 在 `enforce: 'pre'` 插件里安装 cookie 实现，`storage` 走 `useCookie`（服务端要能读 token / locale），`set` 在服务端 no-op；`apiBase` 给服务端补绝对 origin |
| 2 | `src/i18n/index.ts` + `src/adapter/plugins/i18n.ts` | `createAppI18n(locale)` 工厂，**每请求**一个实例，并发 SSR 不串语言 |
| 3 | `src/adapter/plugins/ssr-payload.ts` | `definePayloadPlugin` 把 `IOCtx` 压成 `{status, hasLoaded, data}` 再水合重建（否则 `AbortController` 让整个 `payload.pinia` 序列化失败） |
| 4 | `src/adapter/plugins/http.ts` | handler 只注册一次；store 在**调用时**按当前请求取（`useNuxtApp().$pinia`）；401 跳转只在客户端 |
| 5 | `src/utils/http.ts` + `src/api/client.ts` | `baseURL` 支持函数形态，每次请求解析（Node 下相对地址会抛 `Invalid URL`） |

`definePayloadPlugin` 而不是 `defineNuxtPlugin({ enforce: 'pre' })`：payload 解析早于 `pre` 插件，reviver 必须在解析前注册。

### 页面取数：从 onMounted 迁到 callOnce

页面数据仍在 `onMounted` 里拉时，SSR 首屏只能渲染骨架。要拿到"服务端已带数据"的 HTML，把拉取改成：

```ts
await callOnce('index:list', () => indexPage.fetchList())
```

`callOnce` 服务端执行一次并等待、客户端首屏不重复请求，数据仍落在 store 的 `IOCtx` 里——`ReadData :io` 契约不用动。未迁移的页面不会报错，只是首屏继续是骨架，可以逐页迁移。

## 测试

```text
test/unit/i18n/index.spec.ts    # 词典 key 对齐、执行器切换落盘、te 回落、store 真源不越级
test/unit/utils/io.spec.ts      # IOCtx 状态机
test/unit/utils/http.spec.ts    # handler、requestId、幂等键、遥测
test/unit/utils/websocket.spec.ts # 懒建连、重连带 token、裸/信封两协议配对
test/unit/api/mockChat.spec.ts  # mock 域替身与真信封协议同构（三连、主动推送、无人订阅）
test/unit/pages/login.spec.ts   # 登录页 store：多方式登录、验证码倒计时、回跳来源页
test/unit/pages/chat.spec.ts    # 聊天页 store：流式 reducer、合并播种、在途拒发、退订幂等
test/unit/pages/index.spec.ts   # 首页 store：详情抽屉编排、骨架归零、保存后收抽屉
test/unit/utils/log.spec.ts     # error 上报槽位：未注入零开销、只喂 error、上报器炸了不外抛
test/e2e/example.spec.ts        # 首页布局冒烟 + action 四件套链路（Button → Detail → ReadData → Confirm）
test/e2e/login.spec.ts          # 四链路登录（route 桩回显 method 进 token）
test/e2e/not-found.spec.ts      # 404 兜底页
test/e2e/logout.spec.ts         # 退出登录跳转
test/e2e/locale.spec.ts         # 中英切换：文案 / 标题 / html lang / 持久化
test/e2e/chat.spec.ts           # AI 聊天：信封 ack 历史 + routeWebSocket 桩流式回复
```

- 单测统一 `test/unit/**/*.spec.ts`，由 `vitest.config.ts` 收集；`@/platform` 不经过 Nuxt 插件，直接吃浏览器默认实现；
- e2e 用 `playwright.config.ts`，被测对象必须是构建产物：`npm run build` 后由 `npm run preview` 起 Nitro server（:3173，`E2E_PORT` 可换端口，避免撞上常驻的 dev server）；
- `test/e2e` 不在主 `tsconfig` 内，使用 `test/e2e/tsconfig.json`；
- i18n 跟随浏览器语言：Playwright config 已把 context locale 钉为 `zh-CN`，seed 再落 localStorage 双保险，用例不随运行环境漂移。

## 脚本与环境变量

| 命令 | 说明 |
|---|---|
| `npm run dev` | 开发服务器（3173） |
| `npm run build` | Nitro 服务端构建 → `.output/`（默认部署形态） |
| `npm run preview` | 跑 Nitro server（3173） |
| `npm run generate` | 静态构建（SSG）→ `.output/public/` |
| `npm run typecheck` | `nuxt typecheck` |
| `npm run test:unit` / `test:unit:watch` | Vitest 单次执行 / watch |
| `npm run test:e2e` | `build` + Playwright（对 Nitro server 跑用例） |
| `npm run test:e2e:ui` / `test:e2e:report` | Playwright UI 模式 / 报告 |
| `npm run lint` / `format` / `format:check` | ESLint（含 --fix）/ Prettier 写入 / Prettier 只检查（CI 闸门用这个） |

环境变量参考 `.env.example`（开发环境 `.env.development` 默认 `VITE_API_MOCK=on`）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_BASE_URL` | `/` | 资源基路径；填绝对地址时构建期拆成 `app.baseURL` + `app.cdnURL` |
| `VITE_API_BASE` | `/api` | axios `baseURL`；开 SSR 时必须绝对地址 |
| `VITE_API_MOCK` | `off` | `on` 时仅 `@/api` 域实现指向 mock（传输层不替换） |
| `VITE_WS_URL` | `/user` | socket.io 连接地址 |
| `VITE_LOG_REPORT_URL` | 空 | `log.error` 的上报地址（相对 `VITE_API_BASE` 的路径或绝对地址）；留空即完全关闭上报 |

## 构建与部署

部署有两条路，代码完全一样，只是产物与运行时不同：

| 形态 | 命令 | 产物 | 运行时 |
|---|---|---|---|
| SSR（`nuxt.config` 默认） | `npm run build` | `.output/server` + `.output/public` | Node：`node .output/server/index.mjs` |
| SSG（纯静态） | `npm run generate` | `.output/public`（每个路由一份预渲染 HTML） | 任意 CDN / nginx |

Docker 侧是**两份独立的构建定义**（不是一个文件的两个 `--target`：两条链路的差异不一样长，各自独立更好读，也不会因为改了一边的依赖层而悄悄影响另一边）：

| 文件 | 终点阶段 | 内容 | 用途 |
|---|---|---|---|
| `deploy/Dockerfile`（默认发布形态） | `runtime` | `nginx:alpine` + `.output/public` + `deploy/nginx.conf` | 静态托管，深链回退与 hash 资源长缓存已在 conf 内配好；发布只取中间层 `--target prerender` 的产物 |
| `deploy/ssr.Dockerfile` | `runtime` | `node:24-alpine` + `.output`，`PORT=3173`，带 HEALTHCHECK | 需要内容级 SSR 或服务端路由时；运行期用 `NUXT_*` 覆盖，同一镜像跨环境复用 |
| `deploy/cache.Dockerfile` | —— | 只有 `npm ci` 的依赖层 | CI 预热镜像仓库 |

`deps` 阶段在这三个文件里逐行同构（这是"拆两份"要付的代价），改 lock 或装依赖姿势时必须同步改；预热后两边都能命中同一层缓存。

- SSG 托管需要配 404 回退：未知路径落 `404.html`（规则固化在 `deploy/nginx.conf` 里）；
- 产物 JS/CSS 文件名带内容 hash，适合 CDN 长缓存；
- 因为静态形态的 `runtime` 阶段要 `COPY deploy/nginx.conf`，`deploy` **不能**进 `.dockerignore`。

<details>
<summary>发布脚本（deploy/make_product.sh / make_cache.sh）</summary>

```bash
# 静态发布（默认，走 deploy/Dockerfile）：容器内 nuxt generate → 取 .output/public → 按 commit hash 传 CDN/OSS
CDN_HOST=... TARGET_HOST=... TARGET_BUCKET=... bash deploy/make_product.sh

# SSR 发布（走 deploy/ssr.Dockerfile）：容器内 nuxt build → 打运行镜像，给了 DOCKER_REPO 才推送
RUNTIME=ssr DOCKER_REPO=... bash deploy/make_product.sh
docker run --init -p 3173:3173 front-web:<hash>-ssr
```

脚本一律**从仓库根执行**（构建上下文是根，Dockerfile 路径写作 `deploy/Dockerfile`）。

| 变量 | 必填 | 说明 |
|---|---|---|
| `RUNTIME` | 否 | `static`（默认）或 `ssr`，选上表两个终点之一 |
| `CDN_HOST` | static 必填 | 静态资源域名，默认用 `$CDN_HOST/$hash/` 作为基路径；SSR 形态不需要 |
| `TARGET_HOST` | static 必填 | OSS 域名 |
| `TARGET_BUCKET` | static 必填 | OSS bucket |
| `DOCKER_REPO` | 否 | 给了才 `docker push`（SSR 形态的运行镜像仓库） |
| `APP_NAME` / `REPO_NAME` / `PACKAGE_NAME` | 否 | 镜像/上传目录命名 |
| `API_SERVER` | 否 | 生产接口地址 |
| `VITE_BASE_URL` / `VITE_WS_URL` / `VITE_API_BASE` / `VITE_LOG_REPORT_URL` | 否 | 覆盖默认值 |

`deploy/make_cache.sh` 用于推送依赖缓存镜像，需要 `DOCKER_REPO`，可选 `REGISTRY_USER` / `REGISTRY_PASS`；它与 `Dockerfile` 的 `deps` 阶段逐行同构，改了必须同步改。

</details>

## 贡献约定

- 格式不靠人也不靠评审：`.prettierrc.json` 是唯一真源，提交前 `npm run format`，`npm run format:check` 是闸门；ESLint 只留"对错类"规则（`skip-formatting`），两者不互殴。
- 变量/函数驼峰命名，字符串优先模板字符串。
- 生命周期使用组合式写法，统一放 script 底部并用 `// region 生命周期` 标记。
- 组件优先 Nuxt UI（`U*` 前缀自动注册）；条件文本先声明 Map。
- 图标统一使用 Iconify 类名（`i-lucide-*`，`UIcon` 渲染），不引入第二套图标库。
- 事件直接调用 store action；渲染变量回写 `store.local`。
- IO 数据必须提供 loading 与空状态展示。
- 关键变量用 `log.info` 记录中文日志；只有 `log.error` 进上报通道，可自愈的分支别打 error（否则看板被噪音刷废）。
- 每个 `api/*.ts` 必须有对应 mock。
- 卸载组件时释放 store：`store.$dispose()`。
- 界面文案走 i18n key：`store` / 路由 meta 只存 key，组件内 `useI18n()`，组件外 `i18n.global.t`。
- 语言切换只走 `session.setLocale`，`<html lang>` 与标题的副作用集中在壳层。

以上约定的机器可读版在 `.aider-desk/rules/custom.md`，供 AI Agent 直接引用；改约定请两处同步。

## 已知边界

- 登录仍是脚手架演示实现，未接真实鉴权接口，也没有 refresh token。
- 业务错误码（HTTP 200 + `code != 0`）尚未统一处理，可在成功响应 handler 中扩展。
- `http` 实例仍是模块级单例，SSR 下靠"只注册一次 + 调用时取当前请求 store"来隔离；要彻底干净应改成每请求 `createHttp` 并用 provide 注入（改动面涉及所有 `api/*.ts`）。
- **token 落在非 httpOnly cookie**：XSS 可读，且随每个请求发给服务端。要 httpOnly 得改成服务端下发 + `/auth/me` 判登录。
- 页面数据还在 `onMounted` 里拉，所以默认 SSR 的首屏内容只有布局与骨架；要内容级 SSR 需按上文改用 `callOnce`。
- `npm run generate`（SSG）的深链回退由托管层负责：未知路径要落 `404.html`。`deploy/nginx.conf`（静态形态 `runtime` 阶段）已按这条规则配好，换别的 CDN 记得配同样的回退；本地没有专用的静态预览服务器，要验证回退就起那个运行镜像。
- 错误日志上报只在客户端启用，且**最后一批可能随标签页关闭丢失**（`visibilitychange` 尽力补发，没做 `sendBeacon` 与磁盘暂存）；上报的是 `log.error` 的原始 `details`，接真实日志后端前要按业务补脱敏白名单——日志里出现请求体就等于出现业务数据。
- 日志仍会打印 token（`sessionStore.setToken`、socket 建连 URL），只是它们走 `log.info` 不进上报通道；接监控之前应先把这两处脱敏。
- i18n 只覆盖文案：日期 / 数字 / 货币格式化未接，`datetimeFormats`、`n()`、`d()` 尚无可用的 ICU 配置，`lastActive` 目前直接展示后端字符串。
- **Nuxt UI 自带文案未接语言包**：组件内部文案（Table 空态、Drawer 关闭按钮 aria 等）默认英文。Table 空态当前由 `ReadData` 接管不会露出，但一旦使用 Select / DatePicker / Toast 等自带文案的组件，需取 Nuxt UI 官方 locale 文件，在 `app.use(ui)` options 或 `useLocale` 注入，并在壳层语言 watcher 里一并切换。
- 消息为运行期编译：共享 chunk 增加约 57 kB（gzip 约 19 kB）。需要瘦身时接 `@intlify/unplugin-vue-i18n` 预编译，并关闭 `__VUE_I18N_LEGACY_API__` / `__VUE_I18N_FULL_INSTALL__`。

## LLM 评审

<details>
<summary>🤖 本项目由大模型逐维度打分：<strong>总评 8.1 / 10</strong>（点击查看说明）</summary>

评审为静态阅读的主观快照，非 CI 产物。评分维度：架构边界 9、状态建模 8.5、类型即合约 8、交互封装 8、测试与验证回路 8、AI/Agent 友好性 8.5、文档 9、工程成熟度 6。

完整依据、扣分点文件位置与**可复现的评审 prompt** 见 [docs/llm-review.md](docs/llm-review.md)。建议随大版本更新重跑并保留历史快照。

</details>

<!-- badges -->
[shield-node]: https://img.shields.io/badge/node-%E2%89%A524-green
[shield-vue]: https://img.shields.io/badge/Vue-3.5-42b883
[shield-ts]: https://img.shields.io/badge/TypeScript-5.9-3178c6
[shield-vite]: https://img.shields.io/badge/Vite-8-646cff
[shield-nuxt]: https://img.shields.io/badge/Nuxt-4.6-00DC82
[shield-review]: https://img.shields.io/badge/LLM_Review-8.1%2F10-purple
[engines]: package.json
[vue]: https://vuejs.org
[ts]: https://www.typescriptlang.org
[vite]: https://vite.dev
[nuxt]: https://nuxt.com
[llm-review]: docs/llm-review.md
