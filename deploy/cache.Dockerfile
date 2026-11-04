# syntax=docker/dockerfile:1
# 依赖缓存镜像：只装 node_modules，供 CI 预热镜像仓库。
# 与 Dockerfile 的 deps 阶段逐行同构（同样的 WORKDIR / ENV / COPY / RUN），
# 因此 Dockerfile 里的 RUN npm ci 在 CI 预热后能直接命中层缓存——改这里必须同步改那边。
FROM node:24-alpine AS deps

WORKDIR /srv/app

# cypress 二进制只在本地跑 e2e，构建镜像不需要
ENV CYPRESS_INSTALL_BINARY=0

COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
