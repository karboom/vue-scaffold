<route lang="yaml">
meta:
  titleKey: pages.index.title
  requiresAuth: false
</route>

<template>
  <UCard class="mx-auto w-full max-w-[720px]">
    <template #title>
      <span>{{ t('pages.index.cardTitle') }}</span>
    </template>

    <p class="mb-4 text-sm leading-relaxed text-muted">
      {{ t('pages.index.intro', { mode: mockTip }) }}
    </p>

    <ReadData :io="remote.listIo" @retry="indexPage.fetchList()">
      <template #default="{ data }">
        <UTable :data="data.list" :columns="columns" class="text-sm" :ui="{ tr: 'even:bg-elevated/50' }">
          <!-- 操作列：Button 是触点动效壳，真正的动作仍直接打到 store action -->
          <!-- Nuxt UI 的单元格插槽名是 `${列 id}-cell`，插槽参数即 TanStack 的 cell context -->
          <!-- 时间列：后端给的是原始时间串，格式化发生在这里（渲染层），store 不存显示值 -->
          <template #lastActive-cell="{ row }">
            {{ activeText(row.original.lastActive) }}
          </template>

          <template #actions-cell="{ row }">
            <Button>
              <UButton
                size="xs"
                color="neutral"
                variant="outline"
                :label="t('pages.index.actions.detail')"
                @click="indexPage.openDetail(row.original.id)"
              />
            </Button>
          </template>
        </UTable>

        <div class="mt-3 flex items-center gap-2">
          <!-- 页码/边界禁用由 UPagination 内置，翻页动作仍走 store -->
          <UPagination
            size="sm"
            :sibling-count="1"
            :page-count="Math.ceil(data.total / local.pageSize)"
            :model-value="local.page"
            @update:model-value="indexPage.turnPage($event as number)"
          />
          <span class="text-xs text-muted">{{ t('pages.index.pageOf', { page: local.page, total: data.total }) }}</span>
          <UButton :label="t('pages.index.reload')" size="sm" @click="indexPage.fetchList()" />
        </div>
      </template>
    </ReadData>

    <!-- Detail：把 USlideover 的 open 双向同步成标准 v-model，页面只管开关 -->
    <Detail v-model="local.detailOpen">
      <div class="flex flex-col gap-4">
        <h3 class="text-base font-medium">{{ t('pages.index.detail.title') }}</h3>

        <!-- 详情同样是一套四态：骨架 / 取消 / 失败重试 / 空态都由 ReadData 接管 -->
        <ReadData :io="remote.detailIo" @retry="indexPage.fetchDetail()">
          <template #default="{ data }">
            <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt class="text-muted">{{ t('pages.index.columns.name') }}</dt>
              <dd>{{ data.name }}</dd>
              <dt class="text-muted">{{ t('pages.index.columns.company') }}</dt>
              <dd>{{ data.company }}</dd>
              <dt class="text-muted">{{ t('pages.index.columns.phone') }}</dt>
              <dd>{{ data.phone }}</dd>
              <dt class="text-muted">{{ t('pages.index.columns.level') }}</dt>
              <dd>{{ data.level }}</dd>
              <dt class="text-muted">{{ t('pages.index.columns.lastActive') }}</dt>
              <dd>{{ activeText(data.lastActive) }}</dd>
              <dt class="text-muted">{{ t('pages.index.detail.sessions') }}</dt>
              <dd>{{ countText(data.sessions) }}</dd>
              <dt class="text-muted">{{ t('pages.index.detail.tickets') }}</dt>
              <dd>{{ countText(data.tickets) }}</dd>
              <dt class="text-muted">{{ t('pages.index.detail.tags') }}</dt>
              <dd class="flex flex-wrap gap-1">
                <UBadge v-for="tag in data.tags" :key="tag" color="neutral" variant="subtle" :label="tag" />
              </dd>
              <dt class="text-muted">{{ t('pages.index.detail.remark') }}</dt>
              <dd class="leading-relaxed">{{ data.remark }}</dd>
            </dl>

            <!-- Confirm：进入动作区时给一段缩放淡入，提示"这里是会改数据的操作" -->
            <Confirm class="flex flex-col gap-2 border-t border-default pt-4">
              <span class="text-sm text-muted">{{ t('pages.index.actions.upgrade') }}</span>
              <div class="flex items-center gap-2">
                <USelect
                  class="w-40"
                  :items="levelOptions"
                  :model-value="pickedLevel"
                  @update:model-value="indexPage.pickLevel($event as string)"
                />
                <UButton
                  :label="t('pages.index.actions.save')"
                  :loading="local.saving"
                  :disabled="pickedLevel == ''"
                  @click="indexPage.saveLevel()"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  :label="t('pages.index.actions.close')"
                  @click="indexPage.closeDetail()"
                />
              </div>
            </Confirm>
          </template>
        </ReadData>
      </div>
    </Detail>
  </UCard>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { ColumnDef } from '@tanstack/vue-table'
import type { CustomerItem } from '@/api/types/customer'
import { indexStore, levelOptions } from './store'
import * as log from '@/utils/log'
import * as time from '@/utils/time'

const indexPage = indexStore('index')()
const { local, remote, pickedLevel } = storeToRefs(indexPage)

const { t, d, n } = useI18n()

// 列定义走 computed：header 是译文快照，ref 会让切语言后表头留在旧语言
const columns = computed<ColumnDef<CustomerItem, unknown>[]>(() => [
  { accessorKey: 'name', header: t('pages.index.columns.name') },
  { accessorKey: 'company', header: t('pages.index.columns.company') },
  { accessorKey: 'phone', header: t('pages.index.columns.phone') },
  { accessorKey: 'level', header: t('pages.index.columns.level') },
  { accessorKey: 'lastActive', header: t('pages.index.columns.lastActive') },
  // 无 accessorKey 的纯操作列：内容由下面的 #actions-cell 插槽提供
  { id: 'actions', header: t('pages.index.columns.actions') },
])

// mock 开关 -> i18n key：条件文案先声明 Map，不在模板里写三元
// key 用布尔而非 env 原值：VITE_API_MOCK 未注入时也能命中，Map 查找永远是全函数
const apiModeTextMap = new Map<boolean, string>([
  [true, 'pages.index.mockOn'],
  [false, 'pages.index.mockOff'],
])

const mockTip = computed(() => t(apiModeTextMap.get(import.meta.env.VITE_API_MOCK == 'on')!))

/**
 * 时间与数量在渲染层格式化：store 与 api 只存后端原值。
 * 格式化串一旦写进 state 就会被 SSR 烙进 payload，之后切语言、调格式都不会回头重算——
 * 这与"存 key 不存译文"是同一条纪律
 */
const activeText = (value: string): string => {
  const at = time.parseDateTime(value)
  return at ? d(at, 'dateTime') : t('common.noValue')
}

const countText = (value: number): string => n(value, 'decimal')

// region 生命周期
onMounted(() => {
  log.info('Index 页面已挂载，加载客户列表')
  indexPage.fetchList()
})

onUnmounted(() => {
  log.info('Index 页面已卸载，释放 store')
  indexPage.$dispose()
})
// endregion
</script>
