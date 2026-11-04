import axios from 'axios'

export type IOStatus = 'loading' | 'success' | 'error' | 'canceled'

/**
 * 一次远程 IO 的状态对象
 *
 * 两个正交维度：
 *   status    —— 请求当前落在 loading / success / error / canceled
 *   hasLoaded —— 是否曾经成功加载过（决定有没有旧数据可保留）
 *
 * 有效组合：
 *   loading  + false 首载进行（未开始的 IO 也初始化为 loading）
 *   loading  + true  再次加载进行（refreshing，旧数据保留）
 *   success  + true  已加载（首次/再次成功合并）
 *   error    + false 首载失败
 *   error    + true  再次加载失败（旧数据仍然可用）
 *   canceled + false 首载取消
 *
 * run() 是唯一的拉取入口：自动处理 loading/error 复位、
 * abort 上一次在途请求、过期请求的结果/错误不覆盖新请求。
 * 刷新中取消回到 success（旧数据继续有效）；首载取消进入 canceled。
 */
export class IOCtx<T> {
    status: IOStatus = 'loading'
    /**
     * 是否曾经成功加载过。status 表达"当前"，hasLoaded 记录"历史"，
     * 二者正交（error 之后再拉，仍要靠它区分首载骨架还是后台刷新），不可互相推导
     */
    hasLoaded: boolean = false
    error?: Error
    data: T
    controller: AbortController = new AbortController()
    /**
     * data 恒存在（而非 data?: T）是刻意设计：初始值由调用方给骨架/空形状，
     * 界面渲染与 merge 型拉取就永远不用判空——可观测性收口在 status，而不是散落各处的 undefined 检查
     */
    constructor(data: T) {
        this.data = data
    }

    /** 再次加载进行中：用旧数据兜底，界面上只出局部进度提示 */
    get refreshing(): boolean {
        return this.status == 'loading' && this.hasLoaded
    }

    /**
     * 包裹一次拉取。executor 收到 io 本体：
     *   - 取消信号在 io.controller.signal（controller 已在本调用前换新，api.get(io, ...) 老写法同样生效）
     *   - 旧数据在 io.data，merge/分页型拉取可直接读
     * 不收参数的闭包（纯 fake、无信号诉求）依然合法
     */
    async run(executor: (io: IOCtx<T>) => Promise<T>): Promise<void> {
        this.controller.abort()
        const controller = new AbortController()
        this.controller = controller
        this.error = undefined
        this.status = 'loading'

        try {
            const data = await executor(this)
            // 已被更新的 run 接管：丢弃本次结果，避免旧请求覆盖新状态
            if (this.controller !== controller) {
                return
            }
            this.data = data
            this.hasLoaded = true
            this.status = 'success'
        } catch (e) {
            // 同上：过期请求的失败/取消不得改写当前状态
            if (this.controller !== controller) {
                return
            }
            if (axios.isCancel(e)) {
                // 刷新取消：旧数据仍然有效；首载取消单独成态，供界面给重试
                this.status = this.hasLoaded ? 'success' : 'canceled'
                return
            }
            this.error = e as Error
            this.status = 'error'
        }
    }
}
