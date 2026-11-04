<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { sessionStore } from '@/store'
import { persistLocale } from '@/i18n'
import * as log from '@/utils/log'

/**
 * 壳层扇出：store 仍是语言真源，DOM（lang/标题）由 useHead 声明式驱动，不手摸 document。
 * i18n 实例是每请求创建的（见 src/adapter/plugins/i18n.ts），这里只驱动它当前的语言。
 */
const session = sessionStore('app')()
const { local } = storeToRefs(session)

const { t, te, locale: i18nLocale } = useI18n()
const route = useRoute()

const pageTitle = computed(() => {
  const titleKey = String(route.meta.titleKey)
  return te(titleKey) ? t(titleKey) : t('common.appName')
})

useHead({
  title: pageTitle,
  htmlAttrs: { lang: computed(() => local.value.locale) },
})

// 语言变化只从 store 单向流出；immediate 灌一次首帧，与 createI18n 初值同源不闪烁
watch(
  () => local.value.locale,
  locale => {
    log.info('界面语言变化，扇出到 i18n 实例', locale)
    i18nLocale.value = locale
    persistLocale(locale)
  },
  { immediate: true },
)
</script>

<template>
  <!-- UApp 是 Nuxt UI 的全局上下文（toast/modal） -->
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
