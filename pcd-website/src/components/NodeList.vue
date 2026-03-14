<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import type { Node } from '../lib/nodes';
import { formatDateRange } from '../lib/format';

const props = defineProps<{
  nodes: Node[];
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  select: [node: Node];
}>();

const containerRef = ref<HTMLElement | null>(null);
let trap: FocusTrap | null = null;

const sortedNodes = computed(() =>
  [...props.nodes].sort((a, b) => a.event_name.localeCompare(b.event_name))
);

onMounted(() => {
  if (containerRef.value) {
    trap = createFocusTrap(containerRef.value, {
      initialFocus: () => {
        const first = containerRef.value?.querySelector<HTMLButtonElement>('.node-item');
        return first ?? containerRef.value!;
      },
      onDeactivate: () => emit('close'),
      returnFocusOnDeactivate: false,
      escapeDeactivates: true,
      allowOutsideClick: true,
      fallbackFocus: () => containerRef.value!,
    });
  }
});

onUnmounted(() => {
  trap?.deactivate();
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      trap?.activate();
    } else {
      trap?.deactivate();
      document.getElementById('burger-btn')?.focus();
    }
  }
);

function handleKeydown(e: KeyboardEvent) {
  if (!props.open) return;

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const items = Array.from(
      containerRef.value?.querySelectorAll<HTMLButtonElement>('.node-item') ?? []
    );
    if (!items.length) return;

    const current = document.activeElement;
    const idx = items.indexOf(current as HTMLButtonElement);

    if (e.key === 'ArrowDown') {
      const next = idx < items.length - 1 ? items[idx + 1] : items[0];
      next?.focus();
    } else {
      const prev = idx > 0 ? items[idx - 1] : items[items.length - 1];
      prev?.focus();
    }
  }
}
</script>

<template>
  <div
    ref="containerRef"
    role="dialog"
    aria-modal="true"
    aria-label="Node list"
    tabindex="-1"
    v-show="open"
    class="node-list"
    @keydown="handleKeydown"
  >
    <div class="list-header">
      <h2 class="list-title">PCD 2026 Nodes</h2>
      <button
        class="list-close"
        aria-label="Close node list"
        @click="emit('close')"
      >
        ×
      </button>
    </div>

    <ul class="list-items">
      <li v-for="node in sortedNodes" :key="node.id">
        <button
          class="node-item"
          @click="emit('select', node)"
        >
          <span class="node-name">{{ node.event_name }}</span>
          <span class="node-location">{{ node.online_event ? 'Online event' : `${node.city}, ${node.country}` }}</span>
          <span class="node-date">{{ node.event_date ? formatDateRange(node.event_date, node.event_end_date) : 'Date TBD' }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.node-list {
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  width: 320px;
  background: var(--color-bg-panel);
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
  z-index: var(--z-overlay);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

@media (max-width: 720px) {
  .node-list {
    width: 100vw;
    height: 100vh;
  }
}

.list-header {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1rem 1rem 4rem;
  background: var(--color-bg-panel);
  border-bottom: 1px solid var(--color-border);
  z-index: 1;
}

.list-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.list-close {
  width: 36px;
  height: 36px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text);
  padding: 0;
  flex-shrink: 0;
}

.list-close:hover {
  background: #f5f5f5;
}

.list-items {
  list-style: none;
  margin: 0;
  padding: 0 0 0.5rem 0;
}

.list-items li {
  margin: 0;
  padding: 0;
}

.node-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  font-family: var(--font-family);
  border-bottom: 1px solid var(--color-border);
  transition: background-color 0.1s ease;
}

.node-item:hover {
  background: #f7f7f7;
}

.node-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
}

.node-location {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.node-date {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}


</style>
