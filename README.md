# vue-scaffold

[![Node][shield-node]][engines] [![Vue 3.5][shield-vue]][vue] [![TypeScript 5.9][shield-ts]][ts] [![Vite 8][shield-vite]][vite] [![Nuxt 4.6][shield-nuxt]][nuxt] [![LLM Review][shield-review]][llm-review]

**Vue 3 + Nuxt 4 + Pinia + Nuxt UI 的中后台脚手架**。单宿主 Nuxt，页面、组件、store、API 全在 `src/` 一个目录里。

- 🚀 **先原型，后真实**：`VITE_API_MOCK=on` 时纯前端就能跑通全站交互给业务方看；方向定下来后逐域补 `src/api/real/*`，关掉开关即切换，页面与 store 一行不动
- 🧩 **交互方式组件封装**（`action/*`）：抽屉、确认框、数据区形态都封在组件里，改一处即全站换姿势（例：详情从右侧抽屉改弹窗，页面不动）
- 🏗 **一套代码两种渲染**：默认 `ssr: true`（首屏 SSR + 站内 CSR）；翻成 `ssr: false` 就退回 SPA，页面写法不变
- 🤖 **AI 友好**：约定是文件、类型是合约、mock 是运行时，Agent 改完能自证
- 🔄 **IOCtx 状态机**：强制把 IO 状态绑定到用户体验（loading、空态、取消），任何时刻用户都知道应用在干什么

## 目录

- [设计要点](#设计要点)
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
- [LLM 评审](#llm-评审)

## 设计要点

### 🧩 action/\*：交互方式组件封装

`src/components/action/` 四个组件：`ReadData`（IOCtx 四态容器）、`Detail`（抽屉 v-model 桥接）、`Confirm`、`Button`。页面只给 success 插槽和 retry 绑定：

```html
<ReadData :io="remote.listIo" @retry="indexPage.fetchList()">
  <template #default="{ data }">
    <UTable :data="data.list" :columns="columns" />
  </template>
</ReadData>
```

表现形式固定在组件里，不开放插槽与样式类 prop，所以"换姿势"是一处改动、全站生效。例：列表项详情现在走 `Detail`（内部是 `USlideover side="right"`），要改成弹窗只需把这一处换成 `UModal`，页面仍是 `v-model="local.detailOpen"`，一行不用动。

| 收益 | 机制 |
|---|---|
| 页面零状态分支 | 四种 status 与 `hasLoaded` 的组合判断只存在于组件内 |
| 错误文案只映射一次 | `code → i18n key`（`codeKeyMap`）在组件内收敛，不按 `error.message` 关键字匹配 |
| 日志自带且不刷屏 | mount / 卸载 / 重试日志写在 `watch(io.error)`，不放 computed（computed 每次渲染都求值） |
| 测试杠杆 | 四态分支在组件测试里穷举一次，一个页面用例即覆盖全站数据区 |

首页 `src/pages/index` 是示例消费方：`Button` 触点 → `Detail` 抽屉 → 抽屉内 `ReadData` → `Confirm` 改等级并 `updateCustomer`。新增页面照这条链路写。

### 🏗 单宿主与能力契约

```text
src/（页面 / 组件 / store / api / i18n / utils）
  └─ 宿主能力只有一个出口：@/platform
       ├─ 契约 + 浏览器默认实现：src/adapter/platform.ts（单测直接用它）
       └─ Nuxt 实现：src/adapter/plugins/platform.ts（启动时 installPlatform 替换）
```

- Nuxt 侧只替换 `preferredLanguage` / `isClient` / `isDev` 和 storage（`useCookie`），单测不需要起 Nuxt 运行时。
- `installPlatform` 换的是内部实现，出口对象不变，模块导入期拿到的 `platform.storage` 引用不会失效。
- 渲染模式只是一个开关：`ssr: true` 首屏 SSR + 站内 CSR，`ssr: false` 纯客户端。页面与 e2e 两种模式共用，切换只影响首屏有没有 HTML。

### 🤖 AI 友好性

让大模型（和新人）能安全改这个仓库：

| 机制 | 位置 | 效果 |
|---|---|---|
| 约定即文件 | `.agents/skills/vue-scaffold/SKILL.md`（`.aider-desk/skills` 软链到它） | 命名、store 工厂、`local/remote` 分区、生命周期 region 标记一份说清，可整篇注入 Agent 上下文 |
| 静态闸门 | `eslint.config.mjs` 的 `app/no-mock-imports` | 业务代码直连 mock 直接报错，其余约定靠类型与 review |
| 类型即合约 | `MessageSchema`、`typeof Real.fn` | 词典缺 key、mock 签名漂移在编译期暴露 |
| mock 即运行时 | `src/api/mock/*` + `VITE_API_MOCK` | 没有后端也能跑全站、能演示；`respond` 可注入 `delay` / `fail` |
| 验证即反馈 | `typecheck` / `lint` / 单测 / e2e | Agent 改完可自证，不依赖人工环境 |
| 单一真源 | `sessionStore.local.locale`、`zh-CN.ts` | 一个概念只有一处可写；理由写在用它的代码注释里 |

> 想先看结论：[docs/llm-review.md](docs/llm-review.md) 用一份可复现的 prompt 对上述特征逐维度打分。

### 🔄 IOCtx：把 IO 状态绑死在用户体验上

`src/utils/io.ts` 用两个正交字段建模一次请求：`status` 表达"当前"，`hasLoaded` 记录"历史"，`refreshing` 只派生不存储。目的是让每种组合都必须落到一个用户看得见的形态：loading 出骨架、刷新出进度条、空数据出 empty、失败出重试、被撤销的请求进 `canceled`。IO 状态不允许只停在 store 里而页面毫无反应，用户任何时刻都知道应用正在干什么。

反面做法是一维 status 枚举再拼 `refreshing`、`firstLoad` 等布尔位，组合一多语义就漂移。组合表见 [IOCtx 请求状态机](#ioctx-请求状态机)。

### 🚀 从原型到真实项目

原型期真正要解决的三件事——快速搭出可点的界面、没有后端也能演示、结论随时可能被推翻——分别由三处内置能力接住：mock 是运行时（`respond` 注入 `delay` / `fail`，空态和错误态不用等后端排期就能演）、交互姿势封在 `action/*`（推翻一个交互决定是一处改动，不是全站返工）、新页面照 `pages/index` 的链路抄（store 工厂 + `local` / `remote` 分区 + `IOCtx`）。

所以这个脚手架适合先把原型跑给业务方看，方向定下来再长成真实项目。升级不是重写，而是逐域替换与补齐：

| 要动的 | 怎么做 | 不需要动的 |
|---|---|---|
| 接口实现 | `types/<domain>.ts` 先行，补 `real/<domain>.ts`，mock 跟着同签名改（`typeof Real.fn` 会在校验） | 页面与 store：仍从 `@/api/<domain>` 导入，不感知实现 |
| 数据来源 | `VITE_API_MOCK=off`、`VITE_API_BASE` 指真后端 | `http` 实例与 handler：token 注入、401、遥测已在 `plugins/http.ts` 注册 |
| 权限 | 原型期靠 `meta.requiresAuth` + `auth.global.ts` 拦；接真实 roles 时改这一处 | 路由与菜单结构：`labelKey` / `titleKey` 存的是 key，不是译文 |
| 可观测 | 配 `VITE_LOG_REPORT_URL`，`log.error` 自动批量上报到监控 | 业务代码里已有的 `log.*` 调用 |
| 首屏 | 逐页把取数从 `onMounted` 迁到 `callOnce` | `ReadData :io` 契约与页面模板 |
| 测试 | e2e 的 `mockApi` 按域逐个换成真实接口 | 用例结构与 `seed` 夹具、视觉基线的锚点写法 |

要留心的是另一头：原型期为了快而绕过约定的代码，升级时全变成返工点——业务文件直连 mock（`app/no-mock-imports` 拦）、把 `t()` 的结果存进 state（切语言不刷新）、`new Date(后端串)`（Safari 直接 `Invalid Date`）。闸门在的就这几处，绕过去等于把成本推到上线前。

## 快速开始

要求 Node 24+（见 `package.json` 的 `engines`，Docker 构建用 `node:24`）。

```bash
npm ci                 # postinstall 跑 nuxt prepare，生成 .nuxt 类型
npm run dev            # :3173，读 .env.development，默认走 mock
npm run build          # SSR 产物 → .output/
npm run preview        # :3173，node .output/server/index.mjs
npm run generate       # 静态产物 → .output/public/

# 验证静态托管的深链回退：直接起线上那份镜像（用的就是 deploy/nginx.conf）
docker build -f deploy/Dockerfile --target runtime . && docker run --rm -p 3173:80 <镜像>
```

## 技术栈

| 分类 | 选型 |
|---|---|
| 框架 | Vue 3.5、Nuxt 4.6（内置 Vue Router）、Pinia 4 |
| UI | Nuxt UI 4（Tailwind CSS 4 + Reka UI）+ Iconify lucide 图标（构建期内联）；样式入口 `src/main.css`，由 `nuxt.config` 的 `css` 引用，缺它全站无样式 |
| 表格 / 校验 | @tanstack/vue-table（`UTable` 的 `ColumnDef`）、Valibot（`UForm` standard-schema 校验，错误文案走 i18n） |
| 构建 | Vite 8、TypeScript 5.9、vue-tsc |
| 请求 | axios、socket.io-client |
| 时间 | luxon（只用于解析后端时间串；格式化仍走 `Intl`，不引第二套词典。实测客户端 JS 体积 +22 KB gzip） |
| 国际化 | vue-i18n 11（Composition API，`legacy: false`） |
| 测试 | Vitest、Playwright |
| Mock | mockjs（构建期 alias 注入） |

内置能力：

- 文件路由、布局、404 兜底、组件自动注册
- zh-CN / en-US 双语、语言偏好落盘、标题与 `<html lang>` 跟随切换
- real / mock 双实现切换；工厂化 HTTP 实例（401、遥测、requestId、幂等键）
- 多阶段 Dockerfile 与 OSS/CDN 发布脚本

## 目录结构

```text
nuxt.config.ts      # 唯一入口：ssr / css / alias / dir / modules / routeRules
vitest.config.ts    # 单测 alias 与 Nuxt 对齐；@/platform 指向 adapter/platform.ts
env.d.ts            # ImportMetaEnv 与 RouteMeta 声明
eslint.config.mjs   # 只管对错（禁业务直连 mock）；格式让位 prettier
.prettierrc.json    # 格式真源：.ts 缩进 4 / .vue 缩进 2，无分号、单引号、printWidth 120

src/                # 页面、组件、store、api、适配层都在这里
├─ app.vue          # 根组件：UApp + NuxtLayout + useHead + locale watcher
├─ main.css         # Tailwind v4 + Nuxt UI 主题入口
├─ assets/          # logo.svg
├─ api/             # client.ts 应用级 http + socket｜types 仅类型｜real 真实实现｜mock 同签名替身
├─ i18n/            # index.ts 装配｜locales/zh-CN.ts 文案与类型真源｜en-US.ts 受 MessageSchema 约束
├─ components/
│  ├─ action/       # ReadData / Detail / Confirm / Button
│  └─ layouts/      # default.vue + 布局 store
├─ pages/           # index / login / chat（各带同名 store.ts）+ [...path].vue 兜底页
├─ adapter/         # 宿主能力与 Nuxt 接线，业务代码不混进来
│  ├─ platform.ts   # 契约 + 浏览器默认实现（@/platform 指向这里）
│  ├─ plugins/      # platform / http / i18n / error / log-report / ssr-payload
│  ├─ middleware/   # auth.global.ts：requiresAuth 守卫
│  └─ modules/      # route-blocks.ts：<route> 块桥接、野路由过滤、alias 重排
├─ utils/           # io / http / websocket / mock / data / log / browser / time
└─ store.ts         # session store（token + 语言真源 locale）

public/             # 原样拷到产物根目录（favicon 等）
.agents/skills/     # 约定真源：vue-scaffold/SKILL.md
.aider-desk/skills  # 手工软链：ln -s ../.agents/skills .aider-desk/skills（.aider* 不入库）
test/               # unit/ Vitest｜e2e/ Playwright（fixtures.ts + *.spec.ts + visual/ 快照基线）
docs/llm-review.md  # LLM 评审打分与可复现 prompt
deploy/             # 三份 Dockerfile + nginx.conf + 发布脚本
```

## 核心概念

### Store 约定

- 工厂写法：`xxxStore(id)()`，每个页面 / 布局一个独立实例。
- State 固定分 `local`（渲染相关）与 `remote`（远程数据），两个类型不拆子类型。
- getter 只放真正的派生值，不写 1:1 转发。
- 组件用 `storeToRefs` 解构 `local` / `remote`；store 本身不解构。
- 页面卸载时 `$dispose()`。
- 生命周期用组合式写法，统一放 script 底部，用 `// region 生命周期` 标记。

```ts
const indexPage = indexStore('index')()
const { local, remote } = storeToRefs(indexPage)
```

### IOCtx 请求状态机

`status` 表达当前（`loading | success | error | canceled`），`hasLoaded` 记录历史（是否曾成功加载）。二者正交，`refreshing` 由它们派生：`status == 'loading' && hasLoaded`。

| status | hasLoaded | 含义 | UI |
|---|---|---|---|
| loading | false | 首载进行中 | 骨架 |
| loading | true | 再次加载进行中 | 旧内容 + 进度条 |
| success | true | 已加载 | 内容 / 空态 |
| error | false | 首载失败 | 错误页 + 重试 |
| error | true | 再次加载失败 | 旧内容 + 错误提示 |
| canceled | false | 首载取消 | 已取消 + 重试 |

`IOCtx<T>` 的公开面：`status` / `hasLoaded` / `error` / `data` / `controller`，加派生 getter `refreshing` 和唯一拉取入口 `run(executor)`。

`run()` 内部处理四件事：abort 上一次请求（过期结果不覆盖新请求）、失败保留旧 `data`（页面仍有旧内容 + 错误提示）、刷新取消回 `success`、首载取消才进 `canceled`。调用方拿不到"半更新"状态。

状态机决定"是什么"，`action/ReadData` 决定"怎么显示"：表里 6 种有效组合各对应一个固定形态，映射只写一次，页面模板零状态分支，用户在请求的任一时刻都能看到确定状态。

## 国际化（i18n）

`src/i18n` 三个角色：locales 给内容，index 给实例，`t` 是出口。

| 文件 | 职责 |
|---|---|
| `index.ts` | 首帧语言（`resolveInitialLocale`）、实例工厂（`createAppI18n`，每请求调用）、落盘（`persistLocale`）、`localeOptions` |
| `locales/zh-CN.ts` | 中文词典，同时派生 `MessageSchema` |
| `locales/en-US.ts` | 英文词典，标注为 `MessageSchema`，缺 / 多 key 编译报错 |

`src/i18n` 也负责把 `datetimeFormats` / `numberFormats` 和 Nuxt UI 官方词典一起装进实例（见下文"时间与数字"）。

`MessageSchema = DeepString<typeof zhCN>`：结构由中文词典派生，其他语言漏 key 或多 key 都在编译期报错。

约定：

- 语言优先级：已保存偏好 > 浏览器语言（`en*` → `en-US`）> `zh-CN`；落盘键 `locale`。
- 组件内 `useI18n()`，组件外（守卫、store）用 `i18n.global.t`。
- **语言真源是 `sessionStore.local.locale`**，写入只走 `session.setLocale(locale)`。i18n 实例、落盘、DOM 由壳层 watcher 被动跟随；绕过它直接改实例，store 与实例就会不一致。
- **首帧同源**：store 初值与 `createAppI18n(resolveInitialLocale())` 走同一个函数，服务端首帧、水合与 watcher 的 `immediate` 因此一致。i18n 实例是每请求工厂产物（见 SSR 适配表 #2），不是单例。
- **存 key 不存译文**：`MenuItem.labelKey`、`RouteMeta.titleKey`、错误码 Map 存的都是 key。把 `t()` 的结果放进 state / ref，切语言就不会刷新（`default.vue` 的 `profileItems` 因此必须是 `computed`）。
- 标题回落：`pageTitle` 先 `te(titleKey)`，不中退到 `common.appName`，不会把 `pages.xxx.title` 这种 key 甩到标签页上。
- 不翻译的内容：开发日志（`log.*` 保持中文）、后端原始 message（按错误码映射到 `error.*`）、语言自称（`中文` / `English`）、接口与 mock 返回的业务数据。
- 词典只做 key 对齐，不给 `t()` 加字面量泛型：`meta.titleKey` 与错误码映射是运行期字符串，严格泛型只会逼出大量断言。

DOM 副作用只在 `src/app.vue` 一处扇出（`useHead` 声明标题与 `html lang`，watcher 里同步 `i18nLocale` 并 `persistLocale`），核心逻辑不碰 `document`。

### 时间与数字

格式化发生在渲染层：store 与 api 只存后端原值，`d()` / `n()` 在模板或插槽里调用。格式化串一旦写进 state，就会被 SSR 烙进 payload，之后切语言、调格式都不会回头重算——与"存 key 不存译文"是同一条纪律。

```ts
const { t, d, n } = useI18n()

const activeText = (value: string): string => {
    const at = time.parseDateTime(value)
    return at ? d(at, 'dateTime') : t('common.noValue')
}
```

| 格式档 | 用途 |
|---|---|
| `date` | 只要日子 |
| `dateTime` | 日子 + 时分（中文 24 小时制） |
| `decimal` | 计数分组 |
| `currency` | 金额（中文 CNY、英文 USD） |

两个必须钉死的地方：

- **显示时区**。`datetimeFormats` 每一项都带 `timeZone: 'Asia/Shanghai'`。不钉就跟着运行环境走：Node 侧常是 UTC、浏览器是用户本地，同一时刻在 SSR 与水合两侧渲染成两个字符串，直接 hydration mismatch。要按访问者本地时区展示，前提是 `platform` 先把时区从客户端带到服务端。
- **时间串的解析**。后端给 `2026-11-05 14:23:45+0800` 这种"可读但非 ISO"的串，不能直接 `new Date(value)`：规范只要求引擎认 `YYYY-MM-DDTHH:mm:ss.sssZ`，空格分隔与无冒号偏移靠的是 V8 的宽容解析，Safari 给 `Invalid Date`。统一走 `src/utils/time.ts` 的 `parseDateTime`，返回 `Date | null`。

  内部分工明确：**偏移换算、闰年、非法日历值交给 luxon**（`Date.UTC` 会把 2 月 30 日顺移成 3 月 2 日还不报错，luxon 的严格解析直接判非法），**形状门禁留在自己这层**——只给日期、只到分钟、偏移写成 `+9999` 这类输入 luxon 都能解出一个像样的时刻，必须先判掉。缺偏移按业务时区 `Asia/Shanghai` 解释，所以调用 luxon 必须显式传 `zone`：不传就跟系统时区走，Node 与浏览器各算一个时刻。

  mock 与 e2e 桩产出的串都带偏移：桩演"不带偏移"的宽松版本，等于没演真实契约。

相对时间（"3 分钟前"）不在 `d()` 的能力内，需要另包一层 `Intl.RelativeTimeFormat`。

### Nuxt UI 自带文案

组件内部文案（Table 空态、Drawer 关闭按钮 aria、Select / Toast 等）用 Nuxt UI 官方词典，注入点只有 `UApp` 一处：

```ts
// src/i18n/index.ts：词典从 @nuxt/ui/locale 取，按 Locale 对齐，出口给壳层
export const uiLocaleOf = (locale: Locale) => uiLocales[locale]
```

```vue
<!-- src/app.vue：uiLocale = computed(() => uiLocaleOf(local.value.locale)) -->
<UApp :locale="uiLocale">
```

组件内部靠 `useLocale()` 读同一份，所以业务代码不需要给任何 `U*` 组件传文案 props。

<details>
<summary>新增一种语言（4 步）</summary>

1. `LOCALES` 加字面量，`localeOptions` 加该语言的自称。
2. 复制 `locales/en-US.ts` 为 `locales/<locale>.ts`，按 `MessageSchema` 补全（编译器会列出缺哪些 key）。
3. 在 `messages`、`datetimeFormats`、`numberFormats` 里各补一份该语言的格式档。
4. `uiLocales` 加一行（官方词典从 `@nuxt/ui/locale` 取），漏了这步组件文案会回落英文。

</details>

## API 层

### 两个概念

- `src/utils/http.ts`：纯基础设施，只导出 `createHttp`，不建实例、不读环境变量。
- `src/api/client.ts`：应用默认实例，`baseURL` 取 `VITE_API_BASE`。

需要第二个后端 / 租户时，再调 `createHttp`：`createHttp({ baseURL: 'https://upload.example.com', timeout: 30000, slowRequestMs: 3000 })`。

### real / mock 无感切换

alias 按前缀匹配、先命中先用，长键必须排在 `@` 之前。`nuxt.config.ts` 与 `vitest.config.ts` 的键序手工保证，Nuxt 侧再由 `src/adapter/modules/route-blocks.ts` 的 `reorderAlias` 按长度重排一次。

| alias | 指向 |
|---|---|
| `@/api/client` | `src/api/client.ts`（固定，不参与切换） |
| `@/api/types/*` | `src/api/types/*`（固定） |
| `@/api/*` | `VITE_API_MOCK=on` 时 `src/api/mock/*`，否则 `src/api/real/*` |
| `@/*` | `src/*` |

业务代码统一从领域入口导入；直接 import real/mock 由 ESLint 拦住：

```ts
import { fetchCustomerList, type CustomerListResult } from '@/api/customer'
```

### 新增一个接口域

1. `src/api/types/<domain>.ts`：只放类型。
2. `src/api/real/<domain>.ts`：真实实现，用 `http.get/post/put/del`。
3. `src/api/mock/<domain>.ts`：用 `typeof Real.fn` 锁签名，并 `export type * from '../types/<domain>'` 透出类型。
4. store 里通过 `@/api/<domain>` 使用。

```ts
// src/api/real/customer.ts
import { http } from '@/api/client'

export type * from '../types/customer'

export const fetchCustomerList = (io: IOCtx<CustomerListResult>, params: CustomerListParams) =>
    http.get(io, { url: '/api/v1/customers', params }).then(res => res.data)

// src/api/mock/customer.ts：签名由 real 锁定，实现不碰 http
export const fetchCustomerList: typeof Real.fetchCustomerList = (io, params) =>
    respond(io, makePage(params.page, params.pageSize))
```

`respond` 的 `delay` / `fail` 用来演 loading 与错误态（缺省延迟随机 0-1s）。`@/api/types/*` 是固定 alias，不参与切换，所以不需要 `src/api/mock/types` 目录。

## HTTP 能力

### 实例

```ts
const http = createHttp({
    baseURL: import.meta.env.VITE_API_BASE,
    timeout: 10000,
    slowRequestMs: 1000,
    onTelemetry: event => report(event),
})
// 返回：get / post / put / del，addReqHandler / addResHandler，
//      handleRequest / handleResponse / handleResponseError
```

<details>
<summary>请求前注入 / 响应处理 / 遥测</summary>

handler 支持异步，按注册顺序串行执行，`addReqHandler` 返回卸载函数：

```ts
const off = http.addReqHandler(config => {
    config.headers.Authorization = `Bearer ${session.local.token}`   // token 为空则不注入
})

http.addResHandler(error => {
    if (!isAxiosError(error) || error.response?.status != 401) return
    // 清 token + 跳登录
})
```

- 自动注入 `X-Request-Id` 便于前后端排障；POST 自动生成 `Idempotency-Key`（调用方已传则不覆盖）。
- token 注入与 401 处理由 `src/adapter/plugins/http.ts` 注册，`utils/http.ts` 不依赖 store / router。
- handler 自身抛错会中断后续 handler 并顶替原始错误，业务 handler 要自己捕获异常。

遥测事件 `HttpTelemetry` 的字段：`requestId / method / url / status / duration / slow / error`。成功、失败、取消都上报，回调抛错不影响业务请求。超过 `slowRequestMs` 记 `HTTP 慢请求` warn，失败记 `HTTP 请求失败` error。

</details>

## WebSocket 能力

### 实例工厂

`src/utils/websocket.ts` 导出 `createSocket`，与 `createHttp` 同构：每实例自持连接、订阅表与 msgId 配对队列，懒建连（首帧、登录页、单测不握手）。应用级实例集中在 `@/api/client`：

```ts
// src/api/client.ts
export const aiSocket = createSocket({
    url: `${import.meta.env.VITE_WS_URL}/ai`,      // pathname 即命名空间
    token: () => sessionStore('app')().local.token, // 惰性取凭证，重连也拿当下最新
    ackTimeout: 15000,
})
```

### 两套协议姿势

| 协议 | 发送 | 应答 / 推送 | 配对方式 |
|---|---|---|---|
| 裸协议 | `emit` / `emitAck` | `listen` | socket.io 自带 ack |
| 信封协议 | `emitCustom` / `emitCustomAck` | `listenCustom` | 业务报文回带同一 `msgId` |

AI 聊天页（`src/pages/chat/`）用信封协议：历史 = `emitCustomAck`，发送 = `emitCustom`，回复 = `listenCustom`（服务端 `start/delta/done` 流式推送）。

- `emitCustomAck` / `emitAck` 内部已调 `ctx.run()`，域函数直接 await。store 侧不要再包一层 run，两层会互相 abort。
- 服务端主动推送复用同一条 `start/delta/done` 管道，客户端零改动。
- `loadHistory` 的播种按 id 合并而非覆盖，主动推送先于历史 ack 上屏时，在途气泡不会被抹掉。

### mock 只替换域层

与 HTTP 同一规则：`src/api/mock/chat.ts` 用本地定时器流式（随机 0-1s "思考"延迟，2~6 字 / 30-90ms 逐段推送），不碰 socket；`src/api/real/chat.ts` 才走 `aiSocket`。代价三条：

1. `socket.io-client` 随 `client.ts` 进所有模式的 bundle（mock 构建约 +13KB gzip，只影响 dev）。
2. `mock=on` 时直接调 `aiSocket` 会真实建连，没有东西拦截，靠约定与 review 兜底。
3. 传输层行为的可测性不靠 mock，靠下面的 e2e 协议桩。

### e2e 与协议桩

生产构建默认 `mock=off`，e2e 走真 socket.io，信封协议是被真实传输的。服务端由 `test/e2e/fixtures.ts` 的 `routeWebSocket` 桩扮演：手动应答 Engine.IO v4 + Socket.IO 握手（`/socket.io/` path + `/user/ai` 命名空间帧），再按协议回 ack 与流式片段。

## 日志与错误上报

`src/utils/log.ts` 是全站唯一的日志出口（`import * as log from '@/utils/log'`，不解构）。它自身零 import：`utils/http` 已经在 import 它，反向引 `@/api/client` 会成环，且上报请求失败会再进 `log.error`，形成"失败 → 上报 → 再失败"的循环。

所以 error 的异步上报走注入槽：

```ts
// src/utils/log.ts：只有 error 进上报通道
export type LogRecord = { level: 'error'; message: string; details: unknown[]; at: number }
export const setLogReporter = (next: LogReporter | null) => { ... }   // 未注入 = 零开销
```

`src/adapter/plugins/log-report.ts` 在客户端启动时把槽位接到 `@/api/client` 的 `http` 实例，于是 `baseURL`（SSR 侧补绝对 origin）、`Authorization`、`X-Request-Id` 与遥测全都跟业务请求同链路。上报侧四条纪律：

| 机制 | 取值 | 目的 |
|---|---|---|
| 批量 | 攒 20 条或每 2s 发一次 | 连环报错不会变成几十次请求 |
| 队列上限 | 200 条，超出丢最老 | 日志不占内存 |
| 递归熔断 | 上报请求自带 `X-Request-Id`，入队时按该 id 丢弃自己的失败回声 | 精确熔断，不误杀同期真错误 |
| 降速静默 | 连续失败 3 次后静默 60s | 日志后端宕机不持续吃用户带宽 |

`VITE_LOG_REPORT_URL` 留空即整个通道不安装（dev 默认空）。上报器内部异常一律转 `console.warn`，不影响业务。服务端不装 reporter：日志本来就进 stdout，且"每请求一个计时器"会泄漏。

## 渲染模式与 SSR

默认 `ssr: true`：首屏由 Node 渲染，站内跳转仍是纯客户端。整站关掉写 `ssr: false`（纯后台项目的常见选择）；只让公开页 SSR 则按路由收窄：

```ts
routeRules: {
  '/': { ssr: true },
  '/login': { ssr: true },
  '/chat': { ssr: false },
}
```

### 已经内置的 SSR 适配

下面五处是"能开 SSR"的必要条件，已实现，翻开关不需要再改代码：

| # | 位置 | 做法 |
|---|---|---|
| 1 | `src/adapter/platform.ts` + `plugins/platform.ts` | 契约 + 浏览器默认实现常驻；Nuxt 在 `enforce: 'pre'` 插件里装 cookie 实现，`storage` 走 `useCookie`（服务端要能读 token / locale），`set` 在服务端 no-op；`apiBase` 给服务端补绝对 origin |
| 2 | `src/i18n/index.ts` + `plugins/i18n.ts` | `createAppI18n(locale)` 工厂，每请求一个实例，并发 SSR 不串语言 |
| 3 | `src/adapter/plugins/ssr-payload.ts` | `definePayloadPlugin` 把 `IOCtx` 压成 `{status, hasLoaded, data}` 再水合重建，否则 `AbortController` 会让整个 `payload.pinia` 序列化失败 |
| 4 | `src/adapter/plugins/http.ts` | handler 只注册一次；store 在调用时按当前请求取（`useNuxtApp().$pinia`）；401 跳转只在客户端 |
| 5 | `src/utils/http.ts` + `src/api/client.ts` | `baseURL` 支持函数形态，每次请求解析（Node 下相对地址会抛 `Invalid URL`） |

payload 解析早于 `pre` 插件，所以 reviver 必须用 `definePayloadPlugin` 注册，不能用 `defineNuxtPlugin({ enforce: 'pre' })`。

### 页面取数：从 onMounted 迁到 callOnce

页面数据还在 `onMounted` 里拉时，SSR 首屏只有骨架。要拿到服务端已带数据的 HTML，把拉取改成：

```ts
await callOnce('index:list', () => indexPage.fetchList())
```

`callOnce` 服务端执行一次并等待，客户端首屏不重复请求，数据仍落进 store 的 `IOCtx`，`ReadData :io` 契约不用动。没迁的页面不会报错，只是首屏仍是骨架，可以逐页迁。

## 测试

```text
test/unit/i18n/index.spec.ts      # 词典 key 对齐、切换落盘、te 回落、store 真源不越级
test/unit/utils/io.spec.ts        # IOCtx 状态机
test/unit/utils/http.spec.ts      # handler、requestId、幂等键、遥测
test/unit/utils/websocket.spec.ts # 懒建连、重连带 token、裸 / 信封两协议配对
test/unit/api/mockChat.spec.ts    # mock 域替身与真信封协议同构（三连、主动推送、无人订阅）
test/unit/pages/login.spec.ts     # 登录 store：多方式登录、验证码倒计时、回跳来源页
test/unit/pages/chat.spec.ts      # 聊天 store：流式 reducer、合并播种、在途拒发、退订幂等
test/unit/pages/index.spec.ts     # 首页 store：详情抽屉编排、骨架归零、保存后收抽屉
test/unit/utils/log.spec.ts       # error 上报槽位：未注入零开销、只喂 error、上报器炸了不外抛
test/e2e/example.spec.ts          # 首页布局冒烟 + 四件套链路（Button → Detail → ReadData → Confirm）
test/e2e/login.spec.ts            # 四条登录链路（route 桩把 method 回显进 token）
test/e2e/not-found.spec.ts        # 404 兜底页
test/e2e/logout.spec.ts           # 退出登录跳转
test/e2e/locale.spec.ts           # 中英切换：文案 / 标题 / html lang / 持久化
test/e2e/chat.spec.ts             # AI 聊天：信封 ack 历史 + routeWebSocket 桩流式回复
test/e2e/visual/pages.spec.ts     # 视觉回归基线（login / 列表 / 详情抽屉 / 聊天 / 404）
```

- 单测由 `vitest.config.ts` 收集，`@/platform` 直接吃浏览器默认实现，不经 Nuxt 插件。
- e2e 由 `playwright.config.ts` 驱动，被测对象必须是构建产物：`npm run build` 后起 Nitro server（`E2E_PORT` 可换端口，避免撞上常驻 dev server）。`test/e2e` 用独立 tsconfig。
- Playwright config 已把 context locale 钉为 `zh-CN`，seed 再落一次，用例不随运行环境语言漂移。

### 视觉回归

用 Playwright 自带的 `toHaveScreenshot()` 快照对比，不引第三方服务。`visual` project 与功能用例分目录（`test/e2e/visual/`），功能用例改动不牵动基线图片。

- **为什么稳定**：e2e 跑构建产物 + `page.route` 桩喂固定数据，viewport/locale 钉死；config 里 `animations: 'disabled'`、`caret: 'hide'` 冻结动画与光标，`maxDiffPixelRatio: 0.01` 容忍字体抗锯齿噪声；`visual` project `retries: 0`——快照抖了该修稳定性，不该靠重试蒙混。
- **写用例**：复用 `fixtures.ts` 的 `seed` + `mockApi`；拍之前等内容锚点可见（表格行、气泡文本、抽屉里的独有字段），聊天页要 poll 到流式 `done` 收口，动画中间帧绝不进基线。有动态内容（相对时间之类）用 `mask` 遮掉。
- **流程**：改动样式后 `npm run test:visual` 校验，失败会产出 expected/actual/diff 三张图；确认是有意变更再 `npm run test:visual:update` 重生成基线，人工 review 图片后随代码一起提交。
- **环境一致性**：基线对 OS 字体渲染敏感（快照名带 `-linux` 后缀）。生成与校验必须在同一镜像内进行——CI 用官方 `mcr.microsoft.com/playwright` 镜像跑 `npx playwright test --project=visual`；本地 OS 与 CI 不一致时只在 CI 里更新基线。

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
| `npm run test:visual` / `test:visual:update` | 视觉回归校验 / 重生成基线（均需先有构建产物） |
| `npm run lint` / `lint:fix` | ESLint 只检查（CI 闸门用这个）/ ESLint 自动修复 |
| `npm run format` / `format:check` | Prettier 写入 / Prettier 只检查（CI 闸门用这个） |

环境变量参考 `.env.example`（开发环境 `.env.development` 默认 `VITE_API_MOCK=on`）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_BASE_URL` | `/` | 资源基路径；填绝对地址时构建期拆成 `app.baseURL` + `app.cdnURL` |
| `VITE_API_BASE` | `/api` | axios `baseURL`；开 SSR 时必须绝对地址 |
| `VITE_API_MOCK` | `off` | `on` 时仅 `@/api` 域实现指向 mock（传输层不替换） |
| `VITE_WS_URL` | `/user` | socket.io 连接地址 |
| `VITE_LOG_REPORT_URL` | 空 | `log.error` 上报地址（相对 `VITE_API_BASE` 的路径或绝对地址）；留空即关闭上报 |

## 构建与部署

两条部署路，代码完全一样，只是产物与运行时不同：

| 形态 | 命令 | 产物 | 运行时 |
|---|---|---|---|
| SSR（`nuxt.config` 默认） | `npm run build` | `.output/server` + `.output/public` | Node：`node .output/server/index.mjs` |
| SSG（纯静态） | `npm run generate` | `.output/public`（每个路由一份预渲染 HTML） | 任意 CDN / nginx |

Docker 侧是**三份独立的构建定义**，不是一个文件的多个 `--target`：两条链路的差异（产物命令、运行镜像、配置注入时机）不一样长，分开放更好读。

| 文件 | 终点阶段 | 内容 | 用途 |
|---|---|---|---|
| `deploy/Dockerfile`（默认发布形态） | `runtime` | `nginx:alpine` + `.output/public` + `deploy/nginx.conf` | 静态托管；深链回退与 hash 资源长缓存已在 conf 内配好。发布只取中间层 `--target prerender` 的产物 |
| `deploy/ssr.Dockerfile` | `runtime` | `node:24-alpine` + `.output`，`PORT=3173`，带 HEALTHCHECK | 需要内容级 SSR 或服务端路由；运行期用 `NUXT_*` 覆盖，同一镜像跨环境复用 |
| `deploy/cache.Dockerfile` | —— | 只有 `npm ci` 的依赖层 | CI 预热镜像仓库 |

代价是三份文件的 `deps` 阶段逐行同构：改 lock 或装依赖姿势必须同步改三处，否则预热缓存不再命中。

- SSG 托管要配 404 回退：未知路径落 `404.html`，规则固化在 `deploy/nginx.conf`；产物文件名带内容 hash，可长缓存。
- 静态形态的 `runtime` 阶段要 `COPY deploy/nginx.conf`，所以 `deploy` **不能**进 `.dockerignore`。

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
| `RUNTIME` | 否 | `static`（默认）或 `ssr`，选上表两份定义之一 |
| `CDN_HOST` | static 必填 | 静态资源域名，默认用 `$CDN_HOST/$hash/` 作基路径；SSR 形态不需要 |
| `TARGET_HOST` | static 必填 | OSS 域名 |
| `TARGET_BUCKET` | static 必填 | OSS bucket |
| `DOCKER_REPO` | 否 | 给了才 `docker push`（SSR 形态的运行镜像仓库） |
| `APP_NAME` / `REPO_NAME` / `PACKAGE_NAME` | 否 | 镜像与上传目录命名 |
| `API_SERVER` | 否 | 生产接口地址 |
| `VITE_BASE_URL` / `VITE_WS_URL` / `VITE_API_BASE` / `VITE_LOG_REPORT_URL` | 否 | 覆盖默认值 |

`deploy/make_cache.sh` 推送依赖缓存镜像，需要 `DOCKER_REPO`，可选 `REGISTRY_USER` / `REGISTRY_PASS`；它与 `Dockerfile` 的 `deps` 阶段逐行同构，改了要同步。

</details>

## 贡献约定

- 格式只认 `.prettierrc.json`：提交前 `npm run format`，CI 闸门跑 `npm run format:check`。ESLint 用 `skip-formatting` 让位，只管对错。
- 变量、函数驼峰命名，字符串优先模板字符串。
- 生命周期用组合式写法，统一放 script 底部并用 `// region 生命周期` 标记。
- 组件优先 Nuxt UI（`U*` 前缀自动注册）；条件文本先声明 Map。
- 图标统一用 Iconify 类名（`i-lucide-*`，`UIcon` 渲染），不引入第二套图标库。
- 事件直接调用 store action；与渲染相关的变量回写 `store.local`。
- IO 数据必须提供 loading 与空状态展示。
- 关键变量用 `log.info` 记录中文日志；只有 `log.error` 进上报通道。可自愈的分支不要打 error，否则监控看板会被噪音淹没。
- 每个 `api/*.ts` 必须有对应 mock，延迟随机 0-1s。
- 卸载组件时释放 store：`store.$dispose()`。
- 界面文案走 i18n key：store 与路由 meta 只存 key，组件内 `useI18n()`，组件外 `i18n.global.t`。
- 时间与数字同理：store 与 api 只存后端原值，`d()` / `n()` 在模板或插槽里调用。格式化串写进 state 就不会随语言和格式档刷新，SSR 还会把它烙进 payload。
- 时间串只走 `parseDateTime`：不在页面 `new Date(串)`，也不绕过它直接调 luxon——形状门禁那道工序不能跳。
- 第三方库的全局静态（luxon 的 `Settings.defaultZone` / `defaultLocale`）不许改：SSR 下模块作用域跨请求共享，改了就是把 A 请求的时区串给 B。这类值只按调用传参。
- 语言切换只走 `session.setLocale`，`<html lang>` 与标题的副作用集中在壳层。

约定的机器可读真源在 `.agents/skills/vue-scaffold/SKILL.md`，改约定请两处同步。

## LLM 评审

<details>
<summary>🤖 本项目由大模型逐维度打分：<strong>总评 8.1 / 10</strong>（点击查看说明）</summary>

评审是静态阅读的主观快照，不是 CI 产物。维度得分：架构边界 9、状态建模 8.5、类型即合约 8、交互封装 8、测试与验证回路 8、AI/Agent 友好性 8.5、文档 9、工程成熟度 6。

完整依据、扣分点的文件位置与可复现的评审 prompt 见 [docs/llm-review.md](docs/llm-review.md)。建议随大版本重跑并保留历史快照。

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
