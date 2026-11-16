<template>
  <section class="flex flex-col gap-3 rounded-lg border p-5" style="border-color: var(--color-accenta-muted, #e5e7eb)">
    <h2 class="text-base font-medium">{{ copy.title }}</h2>
    <p class="text-sm leading-relaxed">{{ copy.body }}</p>
    <p class="text-xs opacity-70">{{ copy.meta }}</p>
  </section>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue'
import * as log from '@/utils/log'

/**
 * 远程页面示例：路由清单直写的目标组件（vue_scaffold/AboutCard）。
 *
 * 设计目的：演示"零 props 也能上路由"——页面级远程不强制宿主喂数据，
 * 文案归远程自己（联邦边界用不了宿主 i18n，自带文案是合法姿势）；
 * 需要数据的远程页参照 HelloWidget：props 纯 JSON 进、事件出。
 */

// 自带文案：Map 姿势与 HelloWidget 的 labelMap 同源，远程侧的"词典"就是组件内一张表
const copy = {
  title: 'AboutCard · 远程提供',
  body: '这条路由在宿主路由表里直写为 mf 坐标：remote-routes 清单（构建期）→ RemotePage 本地桩 → Remote 加载壳跨源拉取本组件。骨架与失败重试由壳接管。',
  meta: 'expose: vue_scaffold/AboutCard · 自包含：无 props、无宿主依赖',
}

// region 生命周期
onMounted(() => {
  log.info('AboutCard 已挂载（远程渲染）')
})
// endregion
</script>
