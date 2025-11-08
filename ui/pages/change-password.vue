<template>
  <div class="auth-page">
    <AppHeader :compact="true" :user="user" @logout="logout" />
    <div class="auth-card panel">
      <h2>Change password</h2>
      <p class="muted">Update your password before continuing.</p>
      <form @submit.prevent="submit">
        <label>
          Current password
          <input v-model="form.oldPassword" type="password" autocomplete="current-password" required />
        </label>
        <label>
          New password
          <input v-model="form.newPassword" type="password" autocomplete="new-password" required />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="form-actions">
          <button type="submit" class="button primary" :disabled="pending">
            {{ pending ? 'Updating…' : 'Update password' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();
const router = useRouter();

const { data: userData, refresh } = await useAsyncData('me-change', () =>
  $fetch('/auth/me', { baseURL: config.public.apiBase, credentials: 'include' })
);
const user = computed(() => userData.value?.user ?? null);

const form = reactive({ oldPassword: '', newPassword: '' });
const pending = ref(false);
const error = ref('');

const submit = async () => {
  pending.value = true;
  error.value = '';
  try {
    await $fetch('/auth/change-password', {
      method: 'POST',
      body: form,
      baseURL: config.public.apiBase,
      credentials: 'include'
    });
    await refresh();
    router.push('/');
  } catch (err: any) {
    error.value = err?.data?.error || 'Failed to update password';
  } finally {
    pending.value = false;
  }
};

const logout = async () => {
  await $fetch('/auth/logout', { method: 'POST', baseURL: config.public.apiBase, credentials: 'include' });
  router.push('/login');
};
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.auth-card {
  width: min(480px, 92vw);
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 64px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.error {
  color: var(--danger);
}
</style>
