// build:mf 的快照步骤：把 provider 产物整体替换到 .mf-dist/（e2e 双服务矩阵的静态侧根）。
// 为什么不用 `cp -r .output/public .mf-dist`：目标目录已存在时 cp 会嵌套出 .mf-dist/public/，
// 静态服务读的却是旧快照——远程新增 expose 后宿主却 404，报错还伪装成 runtime 的 slice 异常。
// 整体替换 = 快照永远是当次构建的完整镜像，不留陈旧 chunk。
import { cpSync, rmSync } from 'node:fs'

rmSync('.mf-dist', { recursive: true, force: true })
cpSync('.output/public', '.mf-dist', { recursive: true })
console.log('联邦 provider 快照完成：.mf-dist/')
