<template>
  <div class="action-button">
    <slot />
  </div>
</template>

<style scoped>
.action-button {
  display: inline-block;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-button:hover {
  animation: bounce 0.5s ease infinite;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-5px) scale(1.1);
  }
}

.action-button:active {
  transform: scale(1);
  animation: none;
}
</style>
