<template>
  <article class="panel card">
    <div class="card-header">
      <div class="card-title">
        <div class="icon-circle">
          <img v-if="app.icon_url" :src="app.icon_url" alt="" class="icon-img" />
          <span v-else>{{ app.icon_emoji || '📦' }}</span>
        </div>
        <div>
          <h2>{{ app.name }}</h2>
          <p class="muted">{{ app.image }}</p>
        </div>
      </div>
      <span class="badge" :class="statusClass">{{ statusLabel }}</span>
    </div>
    <div class="card-metrics">
      <span>CPU: <strong>{{ toPercent(app.cpu_percent) }}</strong></span>
      <span>Memory: <strong>{{ toPercent(app.memory_percent) }}</strong></span>
      <span>Restarts: <strong>{{ app.restarts ?? 0 }}</strong></span>
    </div>
    <div class="categories" v-if="app.categories?.length">
      <span v-for="cat in app.categories" :key="cat.id" class="chip">{{ cat.name }}</span>
    </div>
    <div class="ports" v-if="app.ports?.length">
      <p class="muted">Ports: {{ portList }}</p>
    </div>
    <div class="card-footer">
      <div class="meta">
        <p class="muted" v-if="app.app_url">{{ app.app_url }}</p>
      </div>
      <div class="actions">
        <button class="button ghost" @click="$emit('details', app)">Details</button>
        <button class="button primary" :disabled="!app.app_url" @click="openApp">Open</button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
const props = defineProps<{
  app: any;
}>();

const statusLabel = computed(() => {
  if (!props.app?.status) return 'Unknown';
  if (props.app.status.toLowerCase().includes('up') || props.app.state === 'running') return 'Running';
  if (props.app.status.toLowerCase().includes('exit')) return 'Exited';
  return props.app.status;
});

const statusClass = computed(() => {
  const status = statusLabel.value.toLowerCase();
  if (status.includes('run')) return 'ok';
  if (status.includes('exit') || status.includes('stop')) return 'warn';
  return 'danger';
});

const toPercent = (value?: number | null) => {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)}%`;
};

const portList = computed(() => {
  if (!props.app?.ports) return '';
  return props.app.ports.map((p: any) => `${p.public ?? '•'}:${p.private}/${p.type}`).join(', ');
});

const openApp = () => {
  if (props.app?.app_url) {
    window.open(props.app.app_url, '_blank', 'noopener');
  }
};
</script>

<style scoped>
.card h2 {
  margin: 0;
  font-size: 18px;
}

.muted {
  color: var(--muted);
  margin: 0;
  font-size: 13px;
}

.icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.categories {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ports {
  font-size: 13px;
}
</style>
