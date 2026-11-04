import { defineStore } from 'pinia'
import { IOCtx } from '@/utils/io'
import * as log from '@/utils/log'
import {
    fetchCustomerDetail,
    fetchCustomerList,
    updateCustomer,
    type CustomerDetail,
    type CustomerListResult,
} from '@/api/customer'

/**
 * 首页 demo 状态：演示「store 工厂 + IOCtx + api 封装 + ReadData/Detail/Button/Confirm」的标准用法
 * 用法：indexStore(id)()
 */

/** 详情骨架：data 恒有形状，界面与 merge 型拉取因此永远不用判空（切人查看时回落到它就是"重新加载中"） */
const emptyCustomerDetail: CustomerDetail = {
    id: '',
    name: '',
    company: '',
    level: '',
    phone: '',
    sessions: 0,
    tickets: 0,
    lastActive: '',
    tags: [],
    remark: '',
}

/** 等级候选：与 mock 种子里出现的取值对齐，改这里即可换一套字典 */
export const levelOptions = ['normal', 'vip', 'svip']

export type LocalState = {
    page: number
    pageSize: number
    /** 详情抽屉开关：渲染相关一律进 local，Detail 组件走 v-model */
    detailOpen: boolean
    /** 当前查看/编辑的客户 id */
    activeId: string
    /** 抽屉里待提交的等级：空串表示用户还没动过选择器 */
    pendingLevel: string
    /**
     * 保存请求是否在途：IOCtx 的初始态也是 loading，
     * 按钮不能直接拿 saveIo.status 当 spinner（那样一进抽屉就转），故单列一位
     */
    saving: boolean
}

export type RemoteState = {
    listIo: IOCtx<CustomerListResult>
    detailIo: IOCtx<CustomerDetail>
    saveIo: IOCtx<CustomerDetail>
}

export type IndexState = {
    local: LocalState
    remote: RemoteState
}

export const indexStore = (id: string) =>
    defineStore(`index_${id}`, {
        state: (): IndexState => ({
            local: {
                page: 1,
                pageSize: 10,
                detailOpen: false,
                activeId: '',
                pendingLevel: '',
                saving: false,
            },
            remote: {
                listIo: new IOCtx<CustomerListResult>({ list: [], total: 0, page: 1, pageSize: 10 }),
                detailIo: new IOCtx<CustomerDetail>(emptyCustomerDetail),
                saveIo: new IOCtx<CustomerDetail>(emptyCustomerDetail),
            },
        }),
        getters: {
            /** 等级选择器初值：打开抽屉时用详情回填，未加载完回落骨架的空串 */
            pickedLevel(): string {
                return this.local.pendingLevel != '' ? this.local.pendingLevel : this.remote.detailIo.data.level
            },
        },
        actions: {
            /** 拉取列表 */
            async fetchList() {
                log.info('加载客户列表', this.local.page, this.local.pageSize)
                const io = this.remote.listIo
                // 传 ctx 而非闭包捕获，api 内部才能拿到最新的 controller.signal
                await io.run(ctx =>
                    fetchCustomerList(ctx, {
                        page: this.local.page,
                        pageSize: this.local.pageSize,
                    }),
                )
            },
            /** 翻页：先落页码再拉取，保证请求参数与界面一致 */
            async turnPage(page: number) {
                log.info('客户列表翻页', page)
                this.local.page = page
                await this.fetchList()
            },
            /**
             * 打开详情抽屉并拉取：Detail / ReadData / Button 三件套的入口都收在这一个 action，
             * 模板里只写 @click="indexPage.openDetail(...)"，不建 handleXxx 中间层
             */
            openDetail(id: string) {
                log.info('打开客户详情', id)
                this.local.activeId = id
                this.local.pendingLevel = ''
                // 换人查看先把骨架归零：抽屉里闪现上一位客户的数据，比一片空白更容易被当成 bug
                this.remote.detailIo.data = emptyCustomerDetail
                this.local.detailOpen = true
                void this.fetchDetail()
            },
            /** 拉取详情：失败时 ReadData 出错误态并给重试，重试仍走本 action */
            async fetchDetail() {
                log.info('加载客户详情', this.local.activeId)
                await this.remote.detailIo.run(ctx => fetchCustomerDetail(ctx, this.local.activeId))
            },
            /** 关闭抽屉：只改开关，数据留着——下次打开同一个人可以省一次骨架 */
            closeDetail() {
                log.info('关闭客户详情', this.local.activeId)
                this.local.detailOpen = false
            },
            /** 选择新等级 */
            pickLevel(level: string) {
                log.info('选择客户等级', level)
                this.local.pendingLevel = level
            },
            /**
             * 保存等级：走 updateCustomer，成功后收起抽屉并重拉列表，
             * 让"改了 → 列表立刻可见"这条链路在演示里成立（mock 侧是内存 CRUD，真后端同样成立）
             */
            async saveLevel() {
                const level = this.local.pendingLevel != '' ? this.local.pendingLevel : this.remote.detailIo.data.level
                log.info('更新客户等级', this.local.activeId, level)
                this.local.saving = true
                try {
                    await this.remote.saveIo.run(ctx => updateCustomer(ctx, this.local.activeId, { level }))
                } finally {
                    this.local.saving = false
                }
                if (this.remote.saveIo.status == 'success') {
                    this.local.detailOpen = false
                    await this.fetchList()
                }
            },
        },
    })
