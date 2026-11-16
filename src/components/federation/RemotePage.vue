<template>
  <!-- :key 按坐标重挂：两条远程路由复用同一桩组件时，vue-router 会原地复用实例，
       不打 key 的话 Remote 壳的 onMounted 不会重跑，页面留着上一条远程的组件 -->
  <div class="mx-auto w-full max-w-[720px]">
    <Remote :key="mf" :remote="mf" v-bind="mfProps" />
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

/**
 * 远程页面的通用本地桩：路由表"直写远程"的唯一本地锚点。
 *
 * 归家 federation/ 与 Remote.vue 同目录（联邦家族放一起），但 nuxt.config 里对它排除组件自动注册——
 * 它是被路由记录按 file 引用的桩，不是拿来摆进模板的组件，注册出去反而诱导误用。
 *
 * 设计目的：
 * 1) 路由链路（pages:extend、SSR 路由记录、?macro=true 导入）全程只认本地文件，
 *    远程模块在构建期不存在——所以远程路由不逐个建包装页，全部指向这一个桩；
 * 2) 坐标与静态 props 由 remote-routes 清单写进路由 meta（构建期烤入，SSR 安全），
 *    桩只搬运：meta.mf 交给 Remote 壳加载，meta.mfProps 原样 v-bind 透传；
 * 3) 骨架/失败重试等四态是 Remote 壳的职责，桩不加任何交互，也不碰 store——
 *    桩的存在只为让"这条路由存在"在服务端路由表里成立。
 */

const route = useRoute()

const mf = computed(() => String(route.meta.mf))
// 清单保证 mfProps 恒为对象（缺省 {}），这里只补类型
const mfProps = computed(() => route.meta.mfProps ?? {})
</script>
