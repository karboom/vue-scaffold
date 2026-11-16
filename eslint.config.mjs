import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfigWithVueTs(
  {
    name: 'app/ignores',
    ignores: ['**/dist/**', '**/node_modules/**', '**/.nuxt/**', '**/.output/**', '.mf-dist/**', 'coverage/**', 'test/e2e/**']
  },
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}']
  },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  skipFormatting,
  {
    name: 'app/rules',
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // 下划线前缀的形参/变量视为刻意留空（mock 替身、回调占位）
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    // 业务代码禁止直接 import mock：入口只允许经由构建期 alias 替换；
    // 同理禁止 import federation 目录：远程组件的唯一消费姿势是运行期 <Remote> 壳
    name: 'app/no-mock-imports',
    files: ['src/**/*.{ts,mts,vue,tsx}'],
    ignores: ['src/api/mock/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@/api/mock/*', '**/api/mock/*', '@/federation/*', '**/federation/*'] }]
    }
  },
  {
    // federation 目录的自包含纪律：expose 组件不许依赖宿主 internals
    // （api 域走构建期 alias 会在 remote 侧焊死 real/mock、platform/i18n/router/store 需要一个不认识 remote 的宿主上下文），
    // 契约只允许 vue 组合式 API + props/events 纯 JSON
    name: 'app/federation-self-contained',
    files: ['src/federation/**/*.vue'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@/api/*', '@/platform', '@/i18n', '@/store', 'vue-router', 'vue-i18n'] }]
    }
  }
)