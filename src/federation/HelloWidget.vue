<template>
  <div class="rounded-lg border p-4" style="border-color: var(--color-accenta-muted, #e5e7eb)">
    <h3 class="mb-3 text-sm font-medium">{{ title }}</h3>
    <ul class="flex flex-col gap-2">
      <li v-for="(item, index) in items" :key="item">
        <button class="text-sm underline" type="button" @click="pick(index)">
          {{ labelMap.get(item) ?? item }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
/**
 * 联邦 expose 示例组件：演示 src/federation/ 的提供者纪律。
 *
 * 设计目的（federation 边界三原则）：
 * 1) 契约纯 JSON——props 只收可序列化数据，事件只发普通对象，
 *    宿主负责 IOCtx 取数并以 io.data 传入，组件不 import 宿主 internals；
 * 2) 自包含——显式 import vue 组合式 API，不依赖宿主 app 上下文，
 *    因此不用 useRoute/useI18n/Nuxt UI（它们需要一个不认识 remote 的实例树）；
 * 3) 样式走宿主 CSS 变量（--color-*），不写死色值，主题切换自动跟随。
 */
import { onMounted, onUnmounted } from 'vue'
import * as log from '@/utils/log'

const props = defineProps<{
  title: string
  items: string[]
}>()

const emit = defineEmits<{
  select: [item: string]
}>()

// 条件文本先声明 Map：演示"标签按数据推导"的约定姿势
const labelMap = new Map<string, string>([
  ['alpha', 'Alpha（联邦示例项）'],
  ['beta', 'Beta（联邦示例项）'],
])

const pick = (index: number) => {
  const item = props.items[index]!
  log.info('联邦组件触发选择', item)
  emit('select', item)
}

// region 生命周期
onMounted(() => {
  log.info('HelloWidget 已挂载', props.title, props.items.length)
})

onUnmounted(() => {
  log.info('HelloWidget 已卸载')
})
// endregion
</script>
