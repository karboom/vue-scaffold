<route lang="yaml">
path: /login
meta:
  titleKey: pages.login.title
  requiresAuth: false
  layout: false
</route>

<template>
  <div class="flex min-h-svh items-center justify-center bg-accented p-4">
    <UCard class="w-full max-w-[400px]">
      <template #title>{{ t('pages.login.title') }}</template>

      <UTabs
        :model-value="local.activeTab"
        :items="tabItems"
        @update:model-value="loginPage.setTab($event as LoginTab)"
      >
        <template #password>
          <UForm
            class="flex flex-col gap-3"
            :state="local"
            :schema="passwordSchema"
            @submit="loginPage.submit(router, redirect)"
          >
            <UFormField name="account">
              <UInput v-model="local.account" class="w-full" :placeholder="t('pages.login.account')" />
            </UFormField>
            <UFormField name="password">
              <UInput
                v-model="local.password"
                class="w-full"
                type="password"
                :placeholder="t('pages.login.password')"
              />
            </UFormField>
            <UButton
              type="submit"
              :label="t('pages.login.submit')"
              :loading="local.submittingMethod == 'password'"
              block
            />
          </UForm>
        </template>

        <template #sms>
          <UForm
            class="flex flex-col gap-3"
            :state="local"
            :schema="smsSchema"
            @submit="loginPage.submit(router, redirect)"
          >
            <UFormField name="phone">
              <UInput v-model="local.phone" class="w-full" :placeholder="t('pages.login.phone')" />
            </UFormField>
            <UFormField name="smsCode">
              <div class="flex w-full gap-2">
                <UInput v-model="local.smsCode" class="min-w-0 flex-1" :placeholder="t('pages.login.code')" />
                <UButton
                  :label="
                    local.countdown > 0
                      ? t('pages.login.resendCode', { seconds: local.countdown })
                      : t('pages.login.sendCode')
                  "
                  color="neutral"
                  variant="outline"
                  :loading="loginPage.sendingSms"
                  :disabled="local.countdown > 0 || !local.phone"
                  @click="loginPage.sendSms()"
                />
              </div>
            </UFormField>
            <UAlert
              v-if="loginPage.smsSent"
              color="success"
              variant="subtle"
              :description="t('pages.login.codeSent')"
            />
            <UAlert v-if="loginPage.smsError" color="error" variant="soft" :description="loginPage.smsError" />
            <UButton type="submit" :label="t('pages.login.submit')" :loading="local.submittingMethod == 'sms'" block />
          </UForm>
        </template>
      </UTabs>

      <UAlert
        v-if="loginPage.loginError"
        class="mt-3"
        color="error"
        variant="soft"
        :description="loginPage.loginError"
      />

      <USeparator class="my-4" :label="t('pages.login.oauthTitle')" />
      <div class="flex justify-center gap-4">
        <UTooltip v-for="[method, provider] in oauthProviders" :key="method" :text="t(provider.labelKey)">
          <UButton
            class="rounded-full"
            color="neutral"
            variant="soft"
            :title="t(provider.labelKey)"
            :loading="local.submittingMethod == method"
            @click="oauthActions.get(method)!(router, redirect)"
          >
            <svg
              class="size-5"
              :style="{ color: provider.color }"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path :d="provider.icon" />
            </svg>
          </UButton>
        </UTooltip>
      </div>
    </UCard>
  </div>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useRoute, useRouter, type Router } from 'vue-router'
import { useI18n } from 'vue-i18n'
import * as v from 'valibot'
import type { LoginMethod } from '@/api/login'
import { loginStore, type LoginTab } from './store'
import * as log from '@/utils/log'

const loginPage = loginStore('login')()
const { local } = storeToRefs(loginPage)

const { t } = useI18n()

const router = useRouter()
const route = useRoute()
const redirect = computed(() => String(route.query.redirect ?? '/'))

// Tabs 数据源：value 与 slot 同名，切语言只动 label，必须走 computed
const tabItems = computed(() => [
  { label: t('pages.login.tabPassword'), value: 'password', slot: 'password' },
  { label: t('pages.login.tabSms'), value: 'sms', slot: 'sms' },
])

// UForm 校验（valibot standard-schema）：错误文案 i18n，必须 computed 跟随语言切换
const passwordSchema = computed(() =>
  v.object({
    account: v.pipe(v.string(), v.minLength(1, t('pages.login.errRequired'))),
    password: v.pipe(v.string(), v.minLength(1, t('pages.login.errRequired'))),
  }),
)

const smsSchema = computed(() =>
  v.object({
    phone: v.pipe(v.string(), v.regex(/^1\d{10}$/, t('pages.login.errPhone'))),
    smsCode: v.pipe(v.string(), v.regex(/^\d{4,8}$/, t('pages.login.errCode'))),
  }),
)

// 条件渲染文本先声明 Map：三方登录的文案、图标、颜色一张表管完
const oauthProviders = new Map<LoginMethod, { labelKey: string; color: string; icon: string }>([
  [
    'dingtalk',
    {
      labelKey: 'pages.login.dingtalk',
      color: '#1e9fff',
      icon: 'M12 3a9 9 0 0 1 8.4 12.4l-.7 1.6.5 2.7-2.9-.8-1.7.9a9 9 0 1 1 6.4-16.8Zm4.4 6.8-4.1 7.5c-.3.5-1 .4-1.2-.1l-1-2.9-3-.9c-.6-.2-.7-.9-.2-1.2l8.1-3.9c.5-.3 1 .1.9.6.3-.2.6-.1.7.2l-.2.7Z',
    },
  ],
  [
    'wechat',
    {
      labelKey: 'pages.login.wechat',
      color: '#22c55e',
      icon: 'M9 4.5c-3.9 0-7 2.6-7 5.8 0 1.8 1 3.4 2.5 4.4l-.7 2 2.3-1.2c.8.3 1.7.4 2.6.4m9.5-2.9c0-2.8-2.7-5-6-5s-6 2.2-6 5 2.7 5 6 5c.7 0 1.4-.1 2-.3l1.9 1-.5-1.7c1.6-.9 2.6-2.3 2.6-4Z',
    },
  ],
  [
    'biometric',
    {
      labelKey: 'pages.login.biometric',
      color: '#6366f1',
      icon: 'M12 4a8 8 0 0 0-8 8m16 0a8 8 0 0 0-4.7-7.3M8 20l-1.5-3M12 8a4 4 0 0 0-4 4c0 1.6.5 3.2 1.3 4.6m6.7-8.4a4 4 0 0 1 .5 2c0 2.2-.6 4.3-1.6 6.2m-3.9-.5a17 17 0 0 0-.5-3.9 1.5 1.5 0 0 1 3-.3c.3 1.4.4 2.8.4 4.2',
    },
  ],
])

// 事件直连 store action：按 method 找对应登录动作
const oauthActions = new Map<LoginMethod, (router: Router, redirect: string) => Promise<void>>([
  ['dingtalk', loginPage.loginByDingtalk],
  ['wechat', loginPage.loginByWechat],
  ['biometric', loginPage.loginByBiometric],
])

// region 生命周期
onMounted(() => {
  log.info('登录页已挂载')
})

onUnmounted(() => {
  log.info('登录页已卸载，释放 store')
  // 倒计时 setInterval 属于浏览器定时器，随卸载一并停掉
  loginPage.stopCountdown()
  loginPage.$dispose()
})
// endregion
</script>
