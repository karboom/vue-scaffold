<route lang="yaml">
meta:
  titleKey: pages.federation.title
  requiresAuth: false
</route>

<template>
  <UCard class="mx-auto w-full max-w-[720px]">
    <template #title>
      <span>{{ t('pages.federation.title') }}</span>
    </template>

    <p class="mb-4 text-sm leading-relaxed text-muted">
      {{ t('pages.federation.intro') }}
    </p>

    <!-- Remote 壳：路径 name/Module 对应 NUXT_PUBLIC_MF_HOSTS 的 name；数据与事件全部经 attribute 透传 -->
    <Remote
      remote="vue_scaffold/HelloWidget"
      :title="t('pages.federation.widgetTitle')"
      :items="local.items"
      @select="federationPage.pick($event as string)"
    />

    <!-- 空态→成功态的展示切换：远程回传前不占位 -->
    <p v-if="local.picked != ''" class="mt-4 text-sm" data-testid="federation-picked">
      {{ t('pages.federation.picked', { item: local.picked }) }}
    </p>
  </UCard>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { federationStore } from './store'
import * as log from '@/utils/log'

const federationPage = federationStore('federation')()
const { local } = storeToRefs(federationPage)

const { t } = useI18n()

// region 生命周期
onMounted(() => {
  log.info('Federation 页面已挂载')
})

onUnmounted(() => {
  log.info('Federation 页面已卸载，释放 store')
  federationPage.$dispose()
})
// endregion
</script>
