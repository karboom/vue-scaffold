<template>
  <USlideover v-model:open="visible" side="right" :ui="{ content: 'w-1/2 max-w-none' }" @close="handleClose">
    <!-- USlideover 默认插槽是触发器，面板内容走 #body；进出场动画由组件内置 -->
    <template #body>
      <slot />
    </template>
  </USlideover>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import * as log from '@/utils/log'

/**
 * 详情抽屉。
 *
 * 设计契约：把 USlideover 的 `open` 双向同步成标准 `v-model`，页面只写
 * `v-model="local.detailOpen"`，不接触宿主组件的 props/emits 名字差异；
 * 面板宽度、出场方向、动画与卸载时机由本组件统一固定，不开放样式类 prop。
 */

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = ref(props.modelValue)

watch(
  () => props.modelValue,
  val => {
    visible.value = val
  },
)

watch(visible, val => {
  emit('update:modelValue', val)
})

/** 关闭前的记账点：页面若需要"关闭时清理选中项"，绑 @update:modelValue 即可，这里只留日志 */
const handleClose = () => {
  log.info('关闭 Detail 抽屉')
}

// region 生命周期
onMounted(() => {
  log.info('Detail 组件已挂载', props.modelValue)
})

onBeforeUnmount(() => {
  log.info('Detail 组件即将卸载')
})
// endregion
</script>
