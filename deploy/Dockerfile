# syntax=docker/dockerfile:1
# 静态发布形态（默认）：容器内 nuxt generate → .output/public → nginx 直出。
# 需要 SSR（内容级首屏、服务端路由）时用 deploy/ssr.Dockerfile，两者共用同一套构建期变量。
# 依赖层与 deps 阶段逐行同构于 cache.Dockerfile / ssr.Dockerfile，改了要三处同步（CI 预热靠这个命中缓存）。

ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginx:alpine

# ---------- 依赖层：lock 不变即命中缓存 ----------
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

# 构建期配置由部署脚本注入（Vite 只读 VITE_ 前缀）
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

# ---------- 产物层：SSG 预渲染，每个路由一份 HTML ----------
# 发布脚本 --target prerender 后要的就是这一层的 .output/public
FROM source AS prerender

RUN npm run generate

# ---------- 运行态：nginx 静态托管（自托管时可直接起这个容器） ----------
FROM ${NGINX_IMAGE} AS runtime

# 深链回退与 hash 资源长缓存都在这份 conf 里，deploy 目录因此不能进 .dockerignore
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=prerender /srv/app/.output/public /usr/share/nginx/html

EXPOSE 80
