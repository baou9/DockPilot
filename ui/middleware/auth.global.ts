export default defineNuxtRouteMiddleware(async (to) => {
  const config = useRuntimeConfig();
  try {
    const me = await $fetch<{ user: { must_change_password: boolean } | null }>('/auth/me', {
      baseURL: config.public.apiBase,
      credentials: 'include'
    });
    const user = me.user;
    if (!user) {
      if (to.path !== '/login') {
        return navigateTo('/login');
      }
      return;
    }
    if (user.must_change_password && to.path !== '/change-password') {
      return navigateTo('/change-password');
    }
    if (!user.must_change_password && to.path === '/login') {
      return navigateTo('/');
    }
    if (!user.must_change_password && to.path === '/change-password') {
      return navigateTo('/');
    }
  } catch (err) {
    if (to.path !== '/login') {
      return navigateTo('/login');
    }
  }
});
