<template>
  <div class="app-shell">
    <AppHeader :user="user" @logout="handleLogout" />
    <div class="app-layout">
      <aside class="sidebar panel">
        <button
          class="chip"
          :class="{ active: selectedCategory === 'all' }"
          @click="selectCategory('all')"
        >
          All Apps
        </button>
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="chip"
          :class="{ active: selectedCategory === cat.id }"
          @click="selectCategory(cat.id)"
        >
          {{ cat.name }}
        </button>
      </aside>
      <main>
        <div class="grid apps">
          <AppCard
            v-for="app in filteredApps"
            :key="app.id"
            :app="app"
            @details="goToDetails"
          />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();
const router = useRouter();

const { data: userData, refresh: refreshUser } = await useAsyncData('me', () =>
  $fetch('/auth/me', { baseURL: config.public.apiBase, credentials: 'include' })
);
const user = computed(() => userData.value?.user ?? null);

const { data: appsData, refresh: refreshApps } = await useAsyncData('apps', () =>
  $fetch('/apps', { baseURL: config.public.apiBase, credentials: 'include' })
);

const selectedCategory = ref<'all' | number>('all');

const handleLogout = async () => {
  await $fetch('/auth/logout', { method: 'POST', baseURL: config.public.apiBase, credentials: 'include' });
  await refreshUser();
  router.push('/login');
};

const categories = computed(() => {
  const map = new Map<number, { id: number; name: string }>();
  for (const app of appsData.value || []) {
    for (const cat of app.categories || []) {
      if (!map.has(cat.id)) {
        map.set(cat.id, cat);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
});

const filteredApps = computed(() => {
  if (!appsData.value) return [];
  if (selectedCategory.value === 'all') return appsData.value;
  return appsData.value.filter((app: any) => app.categories?.some((cat: any) => cat.id === selectedCategory.value));
});

function selectCategory(id: 'all' | number) {
  selectedCategory.value = id;
}

function goToDetails(app: any) {
  router.push(`/apps/${app.id}`);
}
</script>
