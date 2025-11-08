<template>
  <button class="button ghost" @click="cycle">
    <span v-if="mode === 'system'">🌓 Auto</span>
    <span v-else-if="mode === 'light'">🌞 Light</span>
    <span v-else>🌜 Dark</span>
  </button>
</template>

<script setup lang="ts">
const colorMode = useColorMode();
const mode = computed(() => colorMode.preference);

const order = ['system', 'light', 'dark'] as const;

const cycle = () => {
  const currentIndex = order.indexOf(colorMode.preference as typeof order[number]);
  const next = order[(currentIndex + 1) % order.length];
  colorMode.preference = next;
};
</script>
