<template>
  <div class="relative">
    <!-- 首载：固定骨架屏（标题条 + 两个内容块） -->
    <div v-if="io.status == 'loading' && !io.hasLoaded" class="flex flex-col gap-2.5 py-1">
      <USkeleton class="h-5 w-[35%]" />
      <USkeleton class="h-18" />
      <USkeleton class="h-18" />
    </div>

    <!-- 首载取消：没有旧数据可用，给取消文案 + 重试 -->
    <UEmpty
      v-else-if="io.status == 'canceled'"
      icon="i-lucide-ban"
      color="neutral"
      :title="t('common.requestCanceled')"
      :actions="retryActions"
    />

    <!-- 首载失败：固定文案映射 + 重试 -->
    <UEmpty
      v-else-if="io.status == 'error' && !io.hasLoaded"
      icon="i-lucide-triangle-alert"
      color="error"
      :title="errorText"
      :actions="retryActions"
    />

    <!-- 空：成功但数据按形态判空 -->
    <UEmpty
      v-else-if="dataEmpty"
      icon="i-lucide-inbox"
      color="neutral"
      :title="t('common.empty')"
      :actions="emptyActions"
    />

    <!-- 有数据：页面内容 + 刷新中进度条 / 刷新失败提示 -->
    <div v-else>
      <UProgress
        v-if="io.refreshing"
        animation="carousel"
        class="absolute inset-x-0 top-0 z-10"
        :ui="{ base: 'h-0.5' }"
      />
      <div v-if="io.status == 'error'" class="mb-2 flex items-center gap-2 text-xs text-error">
        <span>{{ errorText }}</span>
        <UButton :label="t('common.retry')" size="sm" color="neutral" variant="link" @click="retry()" />
      </div>
      <slot :data="io.data" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, watch } from 'vue'
import isEmpty from 'lodash/isEmpty'
import type { AxiosError } from 'axios'
import { useI18n } from 'vue-i18n'
import type { ButtonProps } from '@nuxt/ui/components/Button.vue'
import type { IOCtx } from '@/utils/io'
import * as log from '@/utils/log'

/**
 * IOCtx 状态渲染容器。
 *
 * 设计契约：首载骨架 / 首载取消 / 首载失败 / 空态 / 刷新进度 / 刷新失败
 * 的【表现形式由本组件统一固定】，不开放插槽与样式类 prop——全站一处改、处处生效。
 * 页面只负责两件事：默认插槽提供 success 内容；@retry 绑定拉取 action。
 * empty 由数据形态自动推导（数组/对象走 _.isEmpty），无需页面传参。
 */

const props = defineProps<{
  io: IOCtx<any>
}>()

const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()

const dataEmpty = computed(() => isEmpty(props.io.data))

// axios 错误码 -> i18n key：只按 code 映射
// 原先按 message 关键字匹配的做法不跨语言（英文 message 是 axios 内部约定），已移除
const codeKeyMap = new Map<string, string>([
  ['ERR_NETWORK', 'error.network'],
  ['ERR_CANCELED', 'common.requestCanceled'],
  ['ECONNABORTED', 'error.timeout'],
  ['ETIMEDOUT', 'error.timeout'],
])

const errorText = computed(() => {
  const error = props.io.error as AxiosError
  return t(codeKeyMap.get(error.code ?? '') ?? 'error.unknown', { message: error.message })
})

// 日志放 watch 而不是 computed：computed 每次渲染都会求值，写在里面会刷日志
watch(
  () => props.io.error,
  rawError => {
    if (rawError) {
      const error = rawError as AxiosError
      log.warn('ReadData 捕获错误', error.code, error.message)
    }
  },
)

const retry = () => {
  log.info('ReadData 组件触发重试', props.io.status)
  emit('retry')
}

// 重试按钮固定配置：UEmpty 的 actions 会自动渲染成 UButton
const retryActions = computed<ButtonProps[]>(() => [
  { label: t('common.retry'), size: 'sm', color: 'neutral', variant: 'outline', onClick: retry },
])

// 空态仅在刷新失败（有旧数据兜底但报错）时给重试，与原模板逻辑一致
const emptyActions = computed(() => (props.io.status == 'error' ? retryActions.value : []))

// region 生命周期
onMounted(() => {
  log.info('ReadData 组件已挂载', props.io.status)
})

onUnmounted(() => {
  log.info('ReadData 组件已卸载')
})
// endregion
</script>
