<template>
  <UDashboardGroup storage="local">
    <UDashboardSidebar
      id="app-sidebar"
      class="app-sidebar"
      collapsible
      resizable
      :default-size="15"
      :min-size="8"
      :max-size="24"
    >
      <template #header="{ collapsed }">
        <div class="flex min-w-0 flex-1 items-center gap-2.5">
          <img class="size-7 shrink-0" src="@/assets/logo.svg" alt="logo" />
          <span v-if="!collapsed" class="truncate text-sm font-semibold text-highlighted">{{
            t('common.appName')
          }}</span>
        </div>
        <UDashboardSidebarCollapse />
      </template>

      <template #default="{ collapsed }">
        <!-- 全局搜索：唤起命令面板（UDashboardSearch，⌘K） -->
        <UDashboardSearchButton v-if="!collapsed" :placeholder="t('layout.search')" />

        <!-- 2 级菜单：分组折叠、路由高亮、窄化 tooltip/popover 全部内置 -->
        <UNavigationMenu
          :orientation="'vertical'"
          :collapsed="collapsed"
          :items="menuItems"
          popover
          class="min-h-0 flex-1 overflow-y-auto"
        />

        <!-- 侧栏底部：语言切换 + 通知 + 用户区 -->
        <div class="mt-2 flex flex-wrap items-center gap-2 border-t border-default pt-2">
          <div v-if="!collapsed" class="flex shrink-0 gap-1">
            <UButton
              v-for="option in localeOptions"
              :key="`${option.value}`"
              size="xs"
              :label="option.label"
              :color="sessionLocal.locale == option.value ? 'primary' : 'neutral'"
              :variant="sessionLocal.locale == option.value ? 'solid' : 'ghost'"
              @click="session.setLocale(option.value)"
            />
          </div>
          <UTooltip :text="t('layout.notifications')">
            <UChip :text="local.unreadCount" color="error">
              <UButton icon="i-lucide-bell" color="neutral" variant="ghost" @click="layout.clearNotifications()" />
            </UChip>
          </UTooltip>

          <!-- 用户区：IOCtx 渲染带 loading / 空状态 -->
          <div class="flex min-w-0 flex-1 items-center">
            <USkeleton v-if="remote.profileIo.status == 'loading' && !remote.profileIo.hasLoaded" class="h-6 w-24" />
            <UButton
              v-else-if="
                remote.profileIo.status == 'canceled' ||
                (remote.profileIo.status == 'error' && !remote.profileIo.hasLoaded)
              "
              :label="t('common.retry')"
              size="xs"
              color="neutral"
              variant="link"
              @click="layout.loadProfile()"
            />
            <UDropdownMenu
              v-else-if="remote.profileIo.data"
              :items="profileItems"
              :content="{ align: 'start', side: 'top' }"
            >
              <button class="inline-flex min-w-0 items-center gap-2 rounded-md px-2 py-1 hover:bg-elevated">
                <UAvatar :text="profileInitial" size="xs" />
                <span class="truncate text-xs text-highlighted">{{ remote.profileIo.data.name }}</span>
              </button>
            </UDropdownMenu>
            <span v-else class="whitespace-nowrap text-xs text-dimmed">{{ t('layout.notLoggedIn') }}</span>
          </div>
        </div>
      </template>
    </UDashboardSidebar>

    <!-- 内容区：滚动与留白由 UDashboardPanel body（overflow-y-auto p-4）接管，不再自套容器 -->
    <UDashboardPanel id="app-main">
      <template #body>
        <router-view />
      </template>
    </UDashboardPanel>

    <UDashboardSearch :groups="searchGroups" />
  </UDashboardGroup>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { layoutStore } from './store'
import * as log from '@/utils/log'
import { localeOptions } from '@/i18n'
import { sessionStore } from '@/store'

const layout = layoutStore('default')()
const { local, remote } = storeToRefs(layout)

// 语言状态取自全局 session store：切换动作直接打到 action，副作用集中在 i18n 与壳层 watcher
const session = sessionStore('app')()
const { local: sessionLocal } = storeToRefs(session)

const { t } = useI18n()

const route = useRoute()
const router = useRouter()

// 菜单 icon 名 -> Iconify 类名（lucide 集合随 @nuxt/ui 构建期内联）
const iconMap = new Map<string, string>([
  ['gauge', 'i-lucide-gauge'],
  ['bot', 'i-lucide-bot'],
])

// 业务菜单树 -> NavigationMenu items：to 匹配路由自动高亮，defaultOpen 保持分组默认展开
const menuItems = computed(() =>
  local.value.menuTree.map(group => ({
    label: t(group.labelKey),
    icon: iconMap.get(group.icon),
    defaultOpen: true,
    children: group.children.map(item => ({
      label: t(item.labelKey),
      icon: iconMap.get(item.icon),
      to: item.path,
    })),
  })),
)

// 命令面板数据源：菜单叶子拍平成可跳转命令
const searchGroups = computed(() => [
  {
    id: 'navigation',
    label: t('layout.menu.scaffold'),
    items: local.value.menuTree.flatMap(group =>
      group.children.map(item => ({
        label: t(item.labelKey),
        icon: iconMap.get(item.icon),
        onSelect: () => {
          log.info('命令面板导航', item.path)
          router.push(item.path)
        },
      })),
    ),
  },
])

// 侧栏用户下拉
const handleLogout = async () => {
  log.info('用户主动退出登录', route.fullPath)
  layout.logout()
  await router.replace('/login')
}

// 必须 computed：菜单项 label 存的是译文快照，ref 会让切语言后旧文案留在弹层里
const profileItems = computed(() => [
  { label: t('layout.profile.info') },
  { label: t('layout.profile.logout'), onSelect: () => handleLogout() },
])

const profileInitial = computed(() => remote.value.profileIo.data?.name.slice(0, 1))

// region 生命周期
onMounted(() => {
  log.info('布局已挂载，加载用户信息')
  layout.loadProfile()
})

onUnmounted(() => {
  log.info('布局已卸载，释放 store')
  layout.$dispose()
})
// endregion
</script>
