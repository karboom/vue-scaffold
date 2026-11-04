#!/bin/bash
# 依赖缓存镜像：CI 预热 node_modules，避免每次发布重装依赖
set -e

hash=${GIT_COMMIT:-$(git rev-parse HEAD)}
repo_name=${REPO_NAME:-front}
package_name=${PACKAGE_NAME:-web}

: "${DOCKER_REPO:?请通过 DOCKER_REPO 指定镜像仓库地址}"

image_full_name="${repo_name}-${package_name}:${hash}-deps"

# 从仓库根执行：Dockerfile 路径相对根，构建上下文也必须是根（要 COPY package*.json）
docker build -t "${image_full_name}" --progress=plain -f deploy/cache.Dockerfile .

if [[ -n ${REGISTRY_USER:-} && -n ${REGISTRY_PASS:-} ]]; then
  echo "${REGISTRY_PASS}" | docker login -u "${REGISTRY_USER}" --password-stdin "${DOCKER_REPO}"
fi

docker tag "${image_full_name}" "${DOCKER_REPO}/${image_full_name}"
docker push "${DOCKER_REPO}/${image_full_name}"