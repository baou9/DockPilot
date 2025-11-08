<template>
  <div class="app-shell">
    <AppHeader :user="user" @logout="logout" />
    <div class="detail-layout">
      <section class="panel detail-card" v-if="app">
        <header class="detail-header">
          <div class="icon-circle">
            <img v-if="app.icon_url" :src="app.icon_url" class="icon-img" alt="" />
            <span v-else>{{ form.icon_emoji || '📦' }}</span>
          </div>
          <div>
            <h2>{{ form.name }}</h2>
            <p class="muted">{{ app.image }}</p>
          </div>
        </header>
        <form class="detail-form" @submit.prevent="save">
          <label>
            Name
            <input v-model="form.name" />
          </label>
          <label>
            App URL
            <input v-model="form.app_url" type="url" placeholder="https://" />
          </label>
          <label>
            Icon emoji
            <input v-model="form.icon_emoji" placeholder="🚀" maxlength="4" />
          </label>
          <label>
            Categories (comma separated)
            <input v-model="categoryInput" placeholder="monitoring, observability" />
          </label>
          <label>
            Notes
            <textarea v-model="form.notes" rows="4" placeholder="Add deployment notes"></textarea>
          </label>
          <label class="pinned">
            <input type="checkbox" v-model="form.pinned" />
            <span>Pin app to top</span>
          </label>
          <div class="form-actions">
            <button type="submit" class="button primary" :disabled="saving">
              {{ saving ? 'Saving…' : 'Save changes' }}
            </button>
          </div>
        </form>
      </section>
      <section class="panel side-card">
        <h3>Storage</h3>
        <ul class="storage-stats">
          <li>
            <span class="label">Writable layer</span>
            <span class="value">{{ fmtBytes(storageCurrent.size_rw) }}</span>
          </li>
          <li>
            <span class="label">Root filesystem</span>
            <span class="value">{{ fmtBytes(storageCurrent.size_rootfs) }}</span>
          </li>
          <li>
            <span class="label">Volumes (sum)</span>
            <span class="value">{{ fmtBytes(storageCurrent.volumes_size) }}</span>
          </li>
        </ul>
        <small class="muted storage-note">Bind mounts expose host paths and their usage cannot be reported by Docker.</small>
        <div v-if="storageMounts.length" class="storage-mounts">
          <h4>Mounts</h4>
          <ul>
            <li v-for="mount in storageMounts" :key="mountKey(mount)">
              <span>{{ mountLabel(mount) }}</span>
              <span class="muted">{{ mountSizeLabel(mount) }}</span>
            </li>
          </ul>
        </div>
        <div v-if="storageHistory.length" class="storage-history">
          <h4>Storage history</h4>
          <ul>
            <li v-for="entry in storageHistory" :key="entry.id">
              <span>{{ formatDate(entry.ts) }}</span>
              <span class="muted">RW {{ fmtBytes(entry.size_rw) }} · Root {{ fmtBytes(entry.size_rootfs) }} · Vol {{ fmtBytes(entry.volumes_size) }}</span>
            </li>
          </ul>
        </div>
        <h3>Custom icon</h3>
        <input type="file" accept="image/*" @change="onIconUpload" />
        <h3>Health checks</h3>
        <ul class="health-list">
          <li v-for="sample in health" :key="sample.id">
            <span>{{ formatDate(sample.ts) }}</span>
            <span :class="['badge', sample.ok ? 'ok' : 'danger']">
              {{ sample.ok ? `${sample.status_code} OK` : 'Down' }}
            </span>
            <span class="muted">{{ sample.latency_ms }} ms</span>
            <span v-if="sample.error" class="muted">{{ sample.error }}</span>
          </li>
        </ul>
        <div v-if="insights.length">
          <h3>AI insights</h3>
          <ul class="insights">
            <li v-for="insight in insights" :key="insight.message">
              <span class="badge" :class="severityClass(insight.severity)">{{ insight.severity }}</span>
              <p>{{ insight.message }}</p>
              <small>{{ insight.suggestion }}</small>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fmtBytes } from '~/utils/format';

const config = useRuntimeConfig();
const router = useRouter();
const route = useRoute();
const id = route.params.id as string;

const { data: userData } = await useAsyncData('me-detail', () =>
  $fetch('/auth/me', { baseURL: config.public.apiBase, credentials: 'include' })
);
const user = computed(() => userData.value?.user ?? null);

const { data: appData, refresh: refreshApp } = await useAsyncData(`app-${id}`, () =>
  $fetch(`/apps/${id}`, { baseURL: config.public.apiBase, credentials: 'include' })
);

const app = computed(() => appData.value ?? null);

const { data: storageData, refresh: refreshStorage } = await useAsyncData(`storage-${id}`, () =>
  $fetch(`/apps/${id}/storage?limit=50`, { baseURL: config.public.apiBase, credentials: 'include' })
);

const storageInfo = computed(() => storageData.value || { current: null, history: [], mounts: [] });

const storageCurrent = computed(() => {
  const current = storageInfo.value?.current || {};
  return {
    size_rw: current.size_rw ?? app.value?.size_rw ?? null,
    size_rootfs: current.size_rootfs ?? app.value?.size_rootfs ?? null,
    volumes_size: current.volumes_size ?? app.value?.volumes_size ?? null
  };
});

const storageMounts = computed(() => storageInfo.value?.mounts || []);
const storageHistory = computed(() => storageInfo.value?.history || []);

const mountKey = (mount: any) => `${mount.type}:${mount.name ?? mount.source ?? mount.destination ?? ''}`;

const mountLabel = (mount: any) => {
  if (mount.type === 'volume') {
    const destination = mount.destination ? ` → ${mount.destination}` : '';
    return `volume (${mount.name || 'unnamed'})${destination}`;
  }
  if (mount.type === 'bind') {
    const destination = mount.destination ? ` → ${mount.destination}` : '';
    return `bind (${mount.source || 'host'})${destination}`;
  }
  if (mount.destination) {
    return `${mount.type} (${mount.destination})`;
  }
  if (mount.source) {
    return `${mount.type} (${mount.source})`;
  }
  return mount.type;
};

const mountSizeLabel = (mount: any) => {
  if (mount.type === 'bind') return 'N/A';
  return fmtBytes(mount.size);
};

const form = reactive({
  name: '',
  app_url: '',
  icon_emoji: '',
  notes: '',
  pinned: false
});

const categoryInput = ref('');
const saving = ref(false);

watch(app, (value) => {
  if (!value) return;
  form.name = value.name;
  form.app_url = value.app_url || '';
  form.icon_emoji = value.icon_emoji || '';
  form.notes = value.notes || '';
  form.pinned = Boolean(value.pinned);
  categoryInput.value = (value.categories || []).map((c: any) => c.name).join(', ');
});

const { data: healthData, refresh: refreshHealth } = await useAsyncData(`health-${id}`, () =>
  $fetch(`/health/${id}?limit=20`, { baseURL: config.public.apiBase, credentials: 'include' })
);

const health = computed(() => healthData.value || []);

const { data: aiData, refresh: refreshAi } = await useAsyncData('ai-insights', () =>
  $fetch('/ai/insights', { baseURL: config.public.apiBase, credentials: 'include' })
, { server: false });

const insights = computed(() => {
  if (!aiData.value?.enabled || !app.value) return [];
  return aiData.value.insights.filter((i: any) => i.app_id === app.value.id);
});

const save = async () => {
  saving.value = true;
  try {
    const categories = categoryInput.value.split(',').map((s) => s.trim()).filter(Boolean);
    await $fetch(`/apps/${id}`, {
      method: 'PATCH',
      body: {
        ...form,
        categories
      },
      baseURL: config.public.apiBase,
      credentials: 'include'
    });
    await Promise.all([refreshApp(), refreshHealth(), refreshAi(), refreshStorage()]);
  } finally {
    saving.value = false;
  }
};

const onIconUpload = async (event: Event) => {
  const files = (event.target as HTMLInputElement).files;
  if (!files?.length) return;
  const body = new FormData();
  body.append('file', files[0]);
  await $fetch(`/apps/${id}/icon`, {
    method: 'POST',
    body,
    baseURL: config.public.apiBase,
    credentials: 'include'
  });
  await refreshApp();
};

const formatDate = (ts: string) => new Date(ts).toLocaleString();

const severityClass = (severity: string) => {
  if (severity === 'critical') return 'danger';
  if (severity === 'warn') return 'warn';
  return 'ok';
};

const logout = async () => {
  await $fetch('/auth/logout', { method: 'POST', baseURL: config.public.apiBase, credentials: 'include' });
  router.push('/login');
};
</script>

<style scoped>
.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 24px;
  padding: 24px;
}

.detail-card {
  padding: 28px;
}

.detail-header {
  display: flex;
  gap: 18px;
  align-items: center;
  margin-bottom: 18px;
}

.detail-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.pinned {
  display: flex;
  align-items: center;
  gap: 12px;
}

.side-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.storage-stats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
  font-size: 13px;
}

.storage-stats .label {
  color: var(--muted);
}

.storage-stats .value {
  font-weight: 600;
  color: var(--text);
}

.storage-note {
  display: block;
  font-size: 12px;
  margin-bottom: 12px;
}

.storage-mounts ul,
.storage-history ul {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  gap: 6px;
  font-size: 13px;
}

.storage-mounts li,
.storage-history li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.storage-history span:first-child {
  font-weight: 600;
}

.health-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.health-list li {
  display: grid;
  grid-template-columns: 160px 120px 80px 1fr;
  gap: 12px;
  align-items: center;
}

.insights {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.insights li {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: rgba(148, 163, 184, 0.05);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

@media (max-width: 960px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }

  .health-list li {
    grid-template-columns: 1fr;
    gap: 6px;
    align-items: flex-start;
  }
}
</style>
