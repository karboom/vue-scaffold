#!/bin/bash
# 发布构建：按 RUNTIME 选一份 Dockerfile（默认 static，与静态托管为主的现状一致）。
#   RUNTIME=static → deploy/Dockerfile      ：容器内 nuxt generate → 取 .output/public → 按 commit hash 传 CDN/OSS
#   RUNTIME=ssr    → deploy/ssr.Dockerfile  ：容器内 nuxt build → 产出 node 直跑 Nitro 的运行镜像，给了 DOCKER_REPO 才推
# 拆两份而不是 --target 分叉：两条链路的差异（产物命令、运行镜像、配置注入时机）不一样长，
# 各自独立读起来更直白，也不会因为改了一边的 deps 而悄悄影响另一边。
# 所有环境差异通过环境变量注入，脚手架不绑定具体项目。脚本从【仓库根】执行：bash deploy/make_product.sh
set -e

# git 基本信息
branch=${GIT_LOCAL_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}
hash=${GIT_COMMIT:-$(git rev-parse HEAD)}

# 仓库基本信息（按需覆盖）
app_name=${APP_NAME:-app}
repo_name=${REPO_NAME:-front}
package_name=${PACKAGE_NAME:-web}

# 运行形态与对应的构建定义
runtime=${RUNTIME:-static}
dockerfile=deploy/Dockerfile
if [[ ${runtime} == "ssr" ]]; then
  dockerfile=deploy/ssr.Dockerfile
elif [[ ${runtime} != "static" ]]; then
  echo "RUNTIME 只能是 static 或 ssr，当前：${runtime}"
  exit 1
fi

# 避免本地操作覆盖线上，本地有未提交文件时禁止构建
if [[ -z ${SKIP_GIT_CHECK:-} && $(git status -s) ]]; then
  echo "本地有未提交文件，禁止构建"
  exit 1
fi

# static 形态把资源基路径指向 CDN 绝对地址（nuxt.config 侧自动拆 baseURL/cdnURL），按 hash 目录发布
if [[ ${runtime} == "static" ]]; then
  : "${CDN_HOST:?请通过 CDN_HOST 指定静态资源域名}"
  : "${TARGET_HOST:?请通过 TARGET_HOST 指定 OSS 域名}"
  : "${TARGET_BUCKET:?请通过 TARGET_BUCKET 指定 OSS bucket}"
  VITE_BASE_URL=${VITE_BASE_URL:-"$CDN_HOST/$hash/"}
else
  # SSR 形态资源与页面同源，基路径保持根
  VITE_BASE_URL=${VITE_BASE_URL:-/}
fi

VITE_API_BASE=${VITE_API_BASE:-${API_SERVER:-/api}}
VITE_API_MOCK=${VITE_API_MOCK:-off}
# 日志上报默认关：留空即不装 reporter（见 src/adapter/plugins/log-report.ts）
VITE_LOG_REPORT_URL=${VITE_LOG_REPORT_URL:-}
VITE_WS_URL=${VITE_WS_URL:-/user}

image_full_name="${repo_name}-${package_name}:${hash}-${runtime}"

# 构建期配置统一从这里进，两个形态共用
build_args=(
  --build-arg VITE_BASE_URL="${VITE_BASE_URL}"
  --build-arg VITE_API_BASE="${VITE_API_BASE}"
  --build-arg VITE_WS_URL="${VITE_WS_URL}"
  --build-arg VITE_API_MOCK="${VITE_API_MOCK}"
  --build-arg VITE_LOG_REPORT_URL="${VITE_LOG_REPORT_URL}"
)

if [[ ${runtime} == "ssr" ]]; then
  # SSR：镜像即产物，运行期用 NUXT_* 覆盖（如 NUXT_API_BASE / NUXT_PORT），同一镜像跨环境复用
  docker build -t "${image_full_name}" --progress=plain -f "${dockerfile}" "${build_args[@]}" .

  if [[ -n ${DOCKER_REPO:-} ]]; then
    if [[ -n ${REGISTRY_USER:-} && -n ${REGISTRY_PASS:-} ]]; then
      echo "${REGISTRY_PASS}" | docker login -u "${REGISTRY_USER}" --password-stdin "${DOCKER_REPO}"
    fi
    docker tag "${image_full_name}" "${DOCKER_REPO}/${image_full_name}"
    docker push "${DOCKER_REPO}/${image_full_name}"
  fi

  echo "SSR 镜像已就绪：${image_full_name}"
  echo "本地试跑：docker run --init -p 3173:3173 ${image_full_name}"
  exit 0
fi

# static：只构建预渲染阶段，取静态产物上传，运行态镜像不落盘
docker build -t "${image_full_name}" --progress=plain -f "${dockerfile}" \
  --target prerender "${build_args[@]}" .

# 从构建镜像里取出产物
rm -rf ./dist
container_id=$(docker create "${image_full_name}")
docker cp "${container_id}":/srv/app/.output/public ./dist
docker rm "${container_id}"

ls ./dist

export UPLOAD_DIR=${UPLOAD_DIR:-/release/${app_name}_${repo_name}_${package_name}/${hash}}
export UPLOAD_ENTRY_DIR=${UPLOAD_ENTRY_DIR:-/release/${app_name}_${repo_name}_${package_name}/${branch}}
bash deploy/upload_oss.sh

rm -rf ./dist
