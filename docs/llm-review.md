# LLM 项目评审：vue-scaffold

> 本页由大模型对代码库的静态阅读评审生成，**不是 CI 产物，不可作为质量承诺**。
> 分数是主观快照，随模型与评审 prompt 漂移；复现方法与原始 prompt 见文末。

## 评审元信息

| 项 | 值 |
|---|---|
| 评审日期 | 2026-11-03 |
| 评审模型 | Claude Sonnet 4.5（经 AiderDesk agent，无工具执行，仅静态阅读） |
| 输入范围 | 全仓源码 + README + eslint/tsconfig/vite 配置（不含 node_modules / dist） |
| 打分基准 | 同类中后台脚手架的"设计取舍质量"，非完成度 |

## 快照：2026-11-04（复核，含闸门实测）

> 与下方 2026-11-03 快照的差别：本轮不是纯静态阅读，四道闸门 + 两个构建产物都在本机跑过；
> 另外仓库已从"双壳（Vite SPA + Nuxt）"收敛为单宿主 Nuxt，`ssr` 默认已翻成 `true`，
> 所以旧快照里"SSR 未启用""e2e 双壳矩阵""`hosts/nuxt/README.md`"三处描述已失效，仅作历史记录保留。

**实测结果**：`nuxt typecheck` 0 错 · `eslint .` 0 错 · Vitest 9 文件 / 63 用例全绿（~1.5s）· Playwright 对 Nitro SSR 产物 12 用例全绿（~5s）· `npm run build` 12.6s / `npm run generate` 预渲染 8 路由 · 客户端产物 1.2 MB（gzip 344 KB，42 个分片）。

**本轮改动及其对维度的影响**：

| 维度 | 变化 | 说明 |
|---|---|---|
| 交互封装 | ↑ | `Detail` / `Button` / `Confirm` 此前"有组件、零消费方"，现由首页示例串起完整链路，并有 e2e 用例守着；`Detail.vue` 的孤例风格（分号 + 双引号）已消除 |
| 测试与验证回路 | ↑ | 新增首页 store 编排用例与 log 上报槽位用例；`action/*` 首次进入 e2e 覆盖面 |
| 可观测性 | ↑ | `log.error` 有了异步上报通道（批量 / 队列上限 / requestId 递归熔断 / 失败静默），且未注入时保持零开销 |
| 工程成熟度 | ↑ | Docker 按形态拆成 `deploy/Dockerfile`（nginx 静态）与 `deploy/ssr.Dockerfile`（node 跑 Nitro）两份独立定义（此前只有 SSG 一条路，与 `ssr: true` 默认值口径不一），SSG 深链回退固化进 `deploy/nginx.conf`；发布脚本按 `RUNTIME` 选文件（默认 `static`），并把 `-f ./Dockerfile` 与"从仓库根执行"的矛盾一并修平。代价如实记账：`deps` 阶段现在在三份 Dockerfile 里同构，改依赖要三处同步 |
| 工具链 | ↑（硬伤已消） | 补了 `.prettierrc.json`（无分号 / 单引号 / `.ts` 缩进 4 / `.vue` 缩进 2 / `arrowParens: avoid` / printWidth 120）+ `.prettierignore`，`npm run format` 从"破坏性脚本"变成一次性归一（44 文件 +745/−594），并新增 `format:check` 作为可进 CI 的闸门；eslint 侧仍是 `skip-formatting`，两者不互殴 |
| 安全 | 持平 | token 仍会进 `log.info`（不进上报通道）、仍是非 httpOnly cookie；已在 README「已知边界」记为接监控前必办项 |

未复跑完整评分 prompt，因此不给新的总分数——按文末 prompt 重跑一次再落总数，避免"两次口径不同的分数并排"误导读者。

## 评分（2026-11-03 快照）

| 维度 | 得分 | 依据 |
|---|---|---|
| 架构边界 | 9 / 10 | `src/` 零宿主代码，宿主差异全部收敛到 `@/platform` 类型契约（`storage` / `preferredLanguage` / `isClient` / `isDev`）；双壳已跑通且有对照表。扣分：`api/client.ts` 与 i18n 实例仍是模块级单例，SSR 前置债明确但未偿还。 |
| 状态建模 | 8.5 / 10 | `IOCtx` 用 `status × hasLoaded` 两个正交维度替代常见的一维 status 拼接，7 种组合各有确定 UI 语义；`refreshing` 为派生值而非存储值；abort / 过期结果 / 刷新失败保留旧数据的边界写进了实现。同类脚手架里少见的严谨度。 |
| 类型即合约 | 8 / 10 | `MessageSchema = DeepString<typeof zhCN>` 让缺 key 编译报错；mock 用 `typeof Real.fn` 锁签名；alias 表把 real/mock 切换隔离在构建层，业务代码不感知。扣分：`t()` 未做字面量泛型（这是有记录的权衡，不算失误）。 |
| 交互封装 | 8 / 10 | `action/*` 四件套设计契约明确（不开放插槽与样式 prop），换来全站一致性的物理载体与测试杠杆；错误映射 `code → i18n key` 只正确一次。扣分：契约靠文档而非 lint 强制。 |
| 测试与验证回路 | 8 / 10 | 单测穷举状态机与 handler；e2e spec + fixtures 双壳矩阵零复制共用；Playwright 钉死 context locale 防漂移。扣分：无覆盖率门槛，e2e 用例数偏少。 |
| AI/Agent 友好性 | 8.5 / 10 | 约定是机器可执行的（工厂 store、local/remote 分区、生命周期 region 标记、每 API 必配 mock），可直接注入 agent rules；每个"为什么"以注释固化在代码旁。扣分：rules 住在 `.aider-desk/`，缺跨工具通用的 `AGENTS.md` / copilot-instructions。 |
| 文档 | 9 / 10 | README 同时回答"怎么用"和"为什么这样设计"，`hosts/nuxt/README.md` 保留 SSR 施工图；"已知边界"诚实列债。 |
| 工程成熟度 | 6 / 10 | 登录是演示实现、业务错误码未统一处理、SSR 未启用、Nuxt UI 自带文案未接语言包、i18n 运行期编译 +57 kB。对"脚手架"定位而言均可接受，但离生产模板尚有距离。 |

**总评：8.1 / 10** —— 设计密度远高于代码量的脚手架；边界与取舍有书面理由，债务有清单。主要风险不在架构，在于"约定靠人（和模型）自觉遵守"的执行力。

## 亮点（同类项目少见）

1. `IOCtx.hasLoaded` 与 `status` 正交的注释写明"二者不可互相推导"——这是踩过坑之后的形态。
2. `ReadData` 把日志写在 `watch(io.error)` 而非 computed，并注释了原因（computed 每渲染求值会刷日志），教训以代码形式固化。
3. e2e 双壳矩阵：同一批 spec 验证 Vite SPA 与 Nuxt 壳，壳回归 = 跑一遍既有 spec，不新增用例。

## 复现方法

将仓库全文（或 README + `src/` 目录）投喂给任一模型，使用如下 prompt：

```text
你是资深前端架构师。通读该 Vue 3 中后台脚手架代码库，按以下维度各打 1-10 分并给出依据：
架构边界 / 状态建模 / 类型即合约 / 交互封装 / 测试回路 / AI-Agent 友好性 / 文档 / 工程成熟度。
最后给总分（等权平均，保留一位小数）。要求：只依据代码与文档中的事实，指出扣分点的具体文件位置，
不臆测未验证的行为，并注明你的模型名称与打分日期。
```

> 建议随大版本更新重跑一次，并在本页顶部追加新日期的快照，保留历史以便对比。
