import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfigWithVueTs(
  {
    name: 'app/ignores',
    ignores: ['**/dist/**', '**/node_modules/**', '**/.nuxt/**', '**/.output/**', 'coverage/**', 'test/e2e/**']
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
    // 业务代码禁止直接 import mock：入口只允许经由构建期 alias 替换
    name: 'app/no-mock-imports',
    files: ['src/**/*.{ts,mts,vue,tsx}'],
    ignores: ['src/api/mock/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@/api/mock/*', '**/api/mock/*'] }]
    }
  }
)