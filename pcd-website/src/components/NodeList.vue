<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import type { Node } from '../lib/nodes';
import { formatDateRange } from '../lib/format';

interface StyleOption { id: string; label: string; }

const props = defineProps<{
  nodes: Node[];
  open: boolean;
  currentStyle: string;
  availableStyles: StyleOption[];
}>();

const emit = defineEmits<{
  close: [];
  select: [node: Node];
  'style-change': [styleId: string];
}>();

const containerRef = ref<HTMLElement | null>(null);
let trap: FocusTrap | null = null;

const sortedNodes = computed(() =>
  [...props.nodes].sort((a, b) => a.name.localeCompare(b.name))
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

    <div class="style-selector">
      <p class="style-label">Map style</p>
      <div class="style-buttons" role="group" aria-label="Map style">
        <button
          v-for="style in availableStyles"
          :key="style.id"
          class="style-btn"
          :class="{ 'style-btn--active': style.id === currentStyle }"
          :aria-pressed="style.id === currentStyle"
          @click="emit('style-change', style.id)"
        >{{ style.label }}</button>
      </div>
    </div>

    <ul class="list-items">
      <li v-for="node in sortedNodes" :key="node.id">
        <button
          class="node-item"
          @click="emit('select', node)"
        >
          <span class="node-name">{{ node.name }}</span>
          <span class="node-location">{{ node.city }}, {{ node.country }}</span>
          <span class="node-date">{{ formatDateRange(node.start_date, node.end_date) }}</span>
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
  padding: 0.5rem 0;
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

.style-selector {
  padding: 0.75rem 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.style-label {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.style-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.style-btn {
  padding: 0.3125rem 0.625rem;
  font-size: 0.8125rem;
  font-family: var(--font-family);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text);
  transition: background-color 0.1s ease, border-color 0.1s ease;
}

.style-btn:hover {
  background: #f5f5f5;
}

.style-btn--active {
  background: #5601A4;
  border-color: #5601A4;
  color: #fff;
}

.style-btn--active:hover {
  background: #6a01c8;
}
</style>
