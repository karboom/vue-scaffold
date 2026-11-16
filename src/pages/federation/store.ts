import { defineStore } from 'pinia'
import * as log from '@/utils/log'

/**
 * 联邦演示页状态：演示"props 进、事件出"的远程组件消费契约
 * 页面无接口数据（remote 为空分区），远程组件回传的选择结果落 local
 * 用法：federationStore(id)()
 */

export type LocalState = {
    /** 远程组件回传的选择结果：空串 = 还没点过 */
    picked: string
    /** 喂给远程组件的候选项：数据主权在宿主，远程只认纯 JSON */
    items: string[]
}

export type RemoteState = Record<string, never>

export type FederationState = {
    local: LocalState
    remote: RemoteState
}

export const federationStore = (id: string) =>
    defineStore(`federation_${id}`, {
        state: (): FederationState => ({
            local: {
                picked: '',
                items: ['alpha', 'beta', 'gamma'],
            },
            remote: {},
        }),
        actions: {
            /** 远程组件 @select 事件的落点：事件参数是普通字符串，契约可跨项目演进 */
            pick(item: string) {
                log.info('收到联邦远程组件回传', item)
                this.local.picked = item
            },
        },
    })
