# syntax=docker/dockerfile:1
# SSR 发布形态：容器内 nuxt build → Nitro 产物 → node 直跑，镜像即产物。
# 与 deploy/Dockerfile（静态形态）结构对称，差异只有三点：产出命令、运行镜像、配置注入时机。
# 运行期差异走 NUXT_* 环境变量（NUXT_PORT / NUXT_HOST / NUXT_* 任意 config 键），
# 所以同一镜像可跨环境复用，不必像静态形态那样每个环境重构建。
# deps 阶段与 Dockerfile / cache.Dockerfile 逐行同构，改了要三处同步。

ARG NODE_IMAGE=node:24-alpine

# ---------- 依赖层 ----------
FROM ${NODE_IMAGE} AS deps

WORKDIR /srv/app

# cypress 二进制只在本地跑 e2e，构建镜像不需要
ENV CYPRESS_INSTALL_BINARY=0

COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

# ---------- 源码 + 构建期配置 ----------
FROM ${NODE_IMAGE} AS source

WORKDIR /srv/app

COPY --from=deps /srv/app/node_modules ./node_modules
COPY . .

# 构建期把接口/资源地址烙进产物（与静态形态一致）；页面数据仍可在运行期用 NUXT_* 覆盖
ARG VITE_BASE_URL=/
ARG VITE_API_BASE=/api
ARG VITE_WS_URL=/user
ARG VITE_API_MOCK=off
ARG VITE_LOG_REPORT_URL=
ENV VITE_BASE_URL=$VITE_BASE_URL \
    VITE_API_BASE=$VITE_API_BASE \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_API_MOCK=$VITE_API_MOCK \
    VITE_LOG_REPORT_URL=$VITE_LOG_REPORT_URL

# ---------- 产物层：.output/{server,public} ----------
FROM source AS build

RUN npm run build

# ---------- 运行态：node 跑 Nitro server ----------
FROM ${NODE_IMAGE} AS runtime

WORKDIR /srv/app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3173

COPY --from=build /srv/app/.output ./.output

EXPOSE 3173

# 探活打的是首页而非专用端点：脚手架不预置健康接口，首页能渲染即代表 renderer 与依赖都在
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget --spider -q "http://127.0.0.1:${PORT}/" || exit 1

CMD ["node", ".output/server/index.mjs"]
