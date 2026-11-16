<template>
  <ClientOnly>
    <!-- 未启用联邦：配置为空是合法状态，给空态提示而不是永远转骨架 -->
    <UEmpty
      v-if="hosts.length == 0"
      icon="i-lucide-plug-zap"
      color="neutral"
      :title="t('common.remoteNotConfigured')"
    />

    <!-- 加载失败：远程宕机/CDN 抖动不许把页面拖成白屏；重试清缓存重拉 -->
    <UEmpty
      v-else-if="status == 'error'"
      icon="i-lucide-triangle-alert"
      color="error"
      :title="t('common.remoteLoadFailed')"
      :actions="retryActions"
    />

    <!-- 成功：远程组件自己渲染；props/事件经 $attrs 原样透传，壳不理解其内容。
         inheritAttrs:false 时透传是显式的——忘了 v-bind="$attrs" 远程就收不到 title/items -->
    <component :is="widget" v-else-if="status == 'ok'" v-bind="$attrs" />

    <!-- 加载中：与 ReadData 同款骨架，全站视觉一致 -->
    <div v-else class="flex flex-col gap-2.5 py-1">
      <USkeleton class="h-5 w-[35%]" />
      <USkeleton class="h-40" />
    </div>

    <!-- SSR 首帧固定出骨架：远程代码在服务端永不执行 -->
    <template #fallback>
      <div class="flex flex-col gap-2.5 py-1">
        <USkeleton class="h-5 w-[35%]" />
        <USkeleton class="h-40" />
      </div>
    </template>
  </ClientOnly>
</template>

<script lang="ts" setup>
import { computed, shallowRef } from 'vue'
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ButtonProps } from '@nuxt/ui/components/Button.vue'
import { parseMfHosts, fetchRemoteComponent } from '@/adapter/remote'
import * as log from '@/utils/log'

/**
 * 联邦远程组件的加载壳。
 *
 * 它不是 action/*：action 封装的是"一类交互"（点击、抽屉、四态渲染）的表现收敛，
 * 而本组件管的是**远程模块的加载与 SSR 边界**——职责是装配期关注点，不是交互动效。
 * 与页面数据无关，所以也不碰 store。
 *
 * 设计契约：
 * 1) 加载状态由本组件固定——未配置 / 加载中骨架 / 失败重试 / 成功渲染四态，
 *    页面只声明远程路径（remote）与透传数据（普通 attribute），不摸加载细节；
 * 2) <ClientOnly> 是硬边界——远程 bundle 只在宿主浏览器解析，SSR 首帧出 fallback 骨架，
 *    宿主 ssr:true 与联邦共存全靠这条纪律；
 * 3) 宿主不认识远程 internals：props 纯 JSON、事件走 $attrs 透传（@select 之类的
 *    监听器随 attribute 一起落到远程组件上），远程也绝不反向 import 宿主。
 */

const props = defineProps<{
  remote: string
}>()

// props/事件全部透传给远程组件：壳自己的 remote 声明不外泄
defineOptions({ inheritAttrs: false })

const { t } = useI18n()

// 清单来自运行期配置（NUXT_PUBLIC_MF_HOSTS 可覆盖）：远程换版本不必重建宿主
const hosts = parseMfHosts(String(useRuntimeConfig().public.mfHosts))

const status = shallowRef<'loading' | 'ok' | 'error'>('loading')
const widget = shallowRef<Component | null>(null)

/**
 * 拉取并落四态：ok 时组件已在手（fetchRemoteComponent 返回的就是组件本体），
 * 失败只记状态、错误由 adapter 层日志留痕；重试直接重跑本函数即可
 */
const load = async () => {
  status.value = 'loading'
  try {
    widget.value = await fetchRemoteComponent(props.remote, hosts)
    status.value = 'ok'
  } catch {
    status.value = 'error'
  } finally {
    log.info('Remote 壳状态推进', props.remote, status.value)
  }
}

// 重试按钮固定配置：UEmpty 的 actions 会自动渲染成 UButton
const retryActions = computed<ButtonProps[]>(() => [
  { label: t('common.retry'), size: 'sm', color: 'neutral', variant: 'outline', onClick: load },
])

// region 生命周期
onMounted(() => {
  log.info('Remote 壳已挂载', props.remote, `宿主清单 ${hosts.length} 个`)
  if (hosts.length > 0) {
    void load()
  }
})

onUnmounted(() => {
  log.info('Remote 壳已卸载', props.remote)
})
// endregion
</script>
