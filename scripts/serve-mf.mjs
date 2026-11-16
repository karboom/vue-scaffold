// 联邦 provider 产物的静态服务器（含 CORS），供 e2e 双服务矩阵使用：
// 宿主（Nitro preview, :3173）与 provider（本脚本, :3177）互不知晓对方的构建。
// 浏览器跨源 import() 远程入口要求 Access-Control-Allow-Origin；远程的 chunk
// 都按 entry 相对路径解析，因此同源内部无需额外配置。
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../.mf-dist', import.meta.url))
const port = Number(process.env.PORT ?? 3177)

const mimeMap = new Map([
    ['.js', 'text/javascript'],
    ['.css', 'text/css'],
    ['.json', 'application/json'],
    ['.svg', 'image/svg+xml'],
    ['.woff2', 'font/woff2'],
])

http.createServer(async (req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0])
    res.setHeader('access-control-allow-origin', '*')
    try {
        const body = await readFile(path.join(root, url))
        res.setHeader('content-type', mimeMap.get(path.extname(url)) ?? 'application/octet-stream')
        res.end(body)
    } catch {
        res.statusCode = 404
        res.end('not found')
    }
}).listen(port, () => console.log(`联邦 provider 静态服务：http://localhost:${port}`))
