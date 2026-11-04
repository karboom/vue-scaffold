<route lang="yaml">
# 文件名不是随手起的：[...path] 是 unplugin-vue-router 与 Nuxt 两套文件路由共同的 catch-all 语法，
# 编译为 /:pathMatch(.*)* 兜底所有未命中路径——这就是本脚手架里"404 页"的唯一正常命名
meta:
  titleKey: pages.notFound.title
  requiresAuth: false
  layout: false
</route>

<template>
  <UError class="not-found-error" :error="errorInfo">
    <template #message>
      <p class="text-sm leading-relaxed text-muted">{{ t('pages.notFound.desc') }}</p>
      <code class="mt-3 inline-block max-w-full break-all rounded-md bg-elevated px-2 py-1 text-xs text-muted">{{
        attemptedPath
      }}</code>
    </template>

    <template #links>
      <UButton :label="t('pages.notFound.home')" @click="goHome()" />
      <UButton :label="t('pages.notFound.back')" color="neutral" variant="outline" @click="goBack()" />
    </template>
  </UError>
</template>

<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import * as log from '@/utils/log'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const attemptedPath = computed(() => route.fullPath)

// UError 的展示数据聚合成一个 getter：statusCode 大字 + statusMessage 标题
const errorInfo = computed(() => ({
  statusCode: 404,
  statusMessage: t('pages.notFound.title'),
}))

const goHome = () => {
  log.info('404 页面返回首页')
  router.push('/')
}

const goBack = () => {
  log.info('404 页面返回上一页', route.fullPath)
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push('/')
}

// region 生命周期
onMounted(() => {
  log.info('404 页面已挂载', route.fullPath)
})

onUnmounted(() => {
  log.info('404 页面已卸载')
})
// endregion
</script>
