<template>
  <div class="action-confirm" :class="{ show: visible }">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const visible = ref(false)

onMounted(() => {
  visible.value = true
})
</script>

<style scoped>
.action-confirm {
  display: inline-block;
  opacity: 0;
  transform: scale(0.5) rotate(-180deg);
  transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.action-confirm.show {
  opacity: 1;
  transform: scale(1) rotate(0deg);
}
</style>
