<route lang="yaml">
path: /chat
meta:
  titleKey: pages.chat.title
  requiresAuth: false
</route>

<template>
  <UCard class="mx-auto w-full max-w-[720px]">
    <template #title>
      <span>{{ t('pages.chat.title') }}</span>
    </template>

    <p class="mb-4 text-sm leading-relaxed text-muted">
      {{ t('pages.chat.intro') }}
    </p>

    <ReadData :io="remote.historyIo" @retry="chatPage.loadHistory()">
      <template #default>
        <div ref="listEl" class="flex h-[380px] flex-col gap-3 overflow-y-auto pr-1">
          <div
            v-for="msg in local.messages"
            :key="msg.id"
            class="flex items-start gap-2"
            :class="msg.role == 'user' ? 'flex-row-reverse' : ''"
          >
            <UAvatar :icon="roleAvatarMap.get(msg.role)!" size="md" class="shrink-0" />
            <div class="max-w-[80%] px-3 py-2 text-sm" :class="bubbleClassMap.get(msg.role)!">
              <p class="whitespace-pre-wrap break-words">{{ msg.content }}</p>
              <!-- 流式在途：三点跳动，done 到达即消失 -->
              <div v-if="msg.streaming" class="flex gap-1 py-1">
                <span class="size-1.5 animate-bounce rounded-full bg-dimmed [animation-delay:-0.3s]" />
                <span class="size-1.5 animate-bounce rounded-full bg-dimmed [animation-delay:-0.15s]" />
                <span class="size-1.5 animate-bounce rounded-full bg-dimmed" />
              </div>
            </div>
          </div>
        </div>
      </template>
    </ReadData>

    <div class="mt-3 flex items-center gap-2">
      <UInput
        v-model="local.input"
        class="flex-1"
        :placeholder="t('pages.chat.placeholder')"
        @keyup.enter="chatPage.send()"
      />
      <UButton :label="t('pages.chat.send')" :disabled="!canSend" @click="chatPage.send()" />
    </div>
  </UCard>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { ChatRole } from '@/api/chat'
import { chatStore } from './store'
import * as log from '@/utils/log'

const chatPage = chatStore('chat')()
const { local, remote, canSend } = storeToRefs(chatPage)

const { t } = useI18n()

// 条件样式先声明 Map：气泡配色与头像按 role 推导，不在模板里堆三元
const bubbleClassMap = new Map<ChatRole, string>([
  ['user', 'bg-primary text-inverted rounded-2xl rounded-tr-sm'],
  ['assistant', 'bg-elevated rounded-2xl rounded-tl-sm'],
])

const roleAvatarMap = new Map<ChatRole, string>([
  ['user', 'i-lucide-user'],
  ['assistant', 'i-lucide-bot'],
])

const listEl = ref<HTMLElement | null>(null)

// 流式追加与新增气泡都要跟到底部：监视"条数 + 末条长度"一个表达式全覆盖
watch(
  () => `${local.value.messages.length}:${local.value.messages.at(-1)?.content.length ?? 0}`,
  async () => {
    await nextTick()
    const el = listEl.value
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  },
)

// region 生命周期
onMounted(() => {
  log.info('Chat 页面已挂载，先订阅推送再拉历史')
  // 顺序说明：历史 ack 与流式推送同源于 ws，先订阅保证 start 不会丢在拉取窗口里
  chatPage.connect()
  chatPage.loadHistory()
})

onUnmounted(() => {
  log.info('Chat 页面已卸载，释放订阅与 store')
  chatPage.disconnect()
  chatPage.$dispose()
})
// endregion
</script>
