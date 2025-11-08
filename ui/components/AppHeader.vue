<template>
  <header class="app-header panel" :class="{ compact }">
    <div class="brand">
      <span class="logo">🚢</span>
      <div>
        <h1>DockPilot</h1>
        <p>Docker App Control Center</p>
      </div>
    </div>
    <div class="actions">
      <ThemeToggle />
      <div class="user-menu" v-if="user">
        <span class="username">{{ user.username }}</span>
        <button class="button ghost" @click="logout">Logout</button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ user: { username: string } | null; compact?: boolean }>(), { compact: false });
const emit = defineEmits<{ (e: 'logout'): void }>();
const user = computed(() => props.user);
const compact = computed(() => props.compact);

const logout = () => {
  emit('logout');
};
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  margin-bottom: 24px;
}

.app-header.compact {
  margin-bottom: 0;
  border-radius: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 16px;
}

.brand h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.brand p {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.logo {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: var(--chip);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.username {
  font-weight: 600;
}
</style>
