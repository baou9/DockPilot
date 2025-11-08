<template>
  <div class="auth-page">
    <AppHeader :compact="true" :user="null" />
    <div class="auth-card panel">
      <h2>Sign in</h2>
      <form @submit.prevent="submit">
        <label>
          Username
          <input v-model="form.username" type="text" autocomplete="username" required />
        </label>
        <label>
          Password
          <input v-model="form.password" type="password" autocomplete="current-password" required />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="button primary" type="submit" :disabled="pending">
          {{ pending ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();
const router = useRouter();
const form = reactive({ username: '', password: '' });
const pending = ref(false);
const error = ref('');

const submit = async () => {
  pending.value = true;
  error.value = '';
  try {
    const res = await $fetch<{ must_change_password: boolean }>('/auth/login', {
      method: 'POST',
      body: form,
      baseURL: config.public.apiBase,
      credentials: 'include'
    });
    if (res.must_change_password) {
      router.push('/change-password');
    } else {
      router.push('/');
    }
  } catch (err: any) {
    error.value = err?.data?.error || 'Login failed';
  } finally {
    pending.value = false;
  }
};
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--bg);
}

.auth-card {
  width: min(420px, 90vw);
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
  margin: 0;
}
</style>
