<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import { Icon } from '@iconify/vue';
import type { Node } from '../lib/nodes';
import { formatDateRange, calendarLinks } from '../lib/format';

const props = defineProps<{
  node: Node | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const panelRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);
let trap: FocusTrap | null = null;

onMounted(() => {
  if (panelRef.value) {
    trap = createFocusTrap(panelRef.value, {
      initialFocus: () => closeButtonRef.value ?? panelRef.value!,
      onDeactivate: () => emit('close'),
      returnFocusOnDeactivate: false,
      escapeDeactivates: true,
      allowOutsideClick: true,
      fallbackFocus: () => panelRef.value!,
    });
  }
});

onUnmounted(() => {
  trap?.deactivate();
});

watch(
  () => props.node,
  (newNode) => {
    if (newNode) {
      trap?.activate();
    } else {
      trap?.deactivate();
      document.getElementById('map')?.focus();
    }
  }
);

function downloadIcs(node: Node) {
  const { icsContent } = calendarLinks(node);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${node.id}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getOsmUrl(node: Node): string {
  const query = node.address
    ? `${node.venue}, ${node.address}`
    : `${node.venue}, ${node.city}, ${node.country}`;
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

function getVenueText(node: Node): string {
  return node.address
    ? `${node.venue}, ${node.address}`
    : `${node.venue}, ${node.city}, ${node.country}`;
}

function getParagraphs(text: string): string[] {
  return text.split(/\n\n+/).filter(Boolean);
}
</script>

<template>
  <aside
    ref="panelRef"
    role="dialog"
    aria-modal="true"
    aria-labelledby="panel-title"
    tabindex="-1"
    :class="['node-panel', { 'node-panel--open': node !== null }]"
  >
    <button
      ref="closeButtonRef"
      class="panel-close"
      aria-label="Close event details"
      @click="emit('close')"
    >
      ×
    </button>

    <template v-if="node">
      <div class="panel-content">
        <div v-if="node.placeholder" class="panel-placeholder">
          ⚠ This is placeholder data. No real event has been confirmed at this location.
        </div>
        <div v-else-if="!node.confirmed" class="panel-unconfirmed">
          ℹ This event has not been confirmed yet.<span v-if="node.forum_url"> <a :href="node.forum_url" target="_blank" rel="noopener noreferrer">Follow the forum thread</a> for updates.</span>
        </div>

        <h2 id="panel-title" class="panel-name">{{ node.name }}</h2>
        <p class="panel-meta">{{ formatDateRange(node.start_date, node.end_date) }}</p>

        <p class="panel-venue">
          <Icon icon="bi:geo-alt-fill" class="panel-icon" width="14" height="14" aria-hidden="true" />
          <a :href="getOsmUrl(node)" target="_blank" rel="noopener noreferrer">{{ getVenueText(node) }}</a>
        </p>

        <div class="panel-description">
          <p
            v-for="(para, i) in getParagraphs(node.long_description ?? node.description)"
            :key="i"
          >{{ para }}</p>
        </div>

        <div class="panel-links">
          <div class="panel-link-row">
            <Icon icon="bi:globe" class="panel-icon" width="14" height="14" aria-hidden="true" />
            <a :href="node.website" target="_blank" rel="noopener noreferrer" class="panel-link">Visit event website</a>
          </div>

          <div class="panel-link-row panel-link-row--cal">
            <Icon icon="bi:calendar" class="panel-icon" width="14" height="14" aria-hidden="true" />
            <a
              :href="calendarLinks(node).googleCalUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="panel-link"
            >Google Calendar</a>
            <span class="panel-link-sep" aria-hidden="true">&middot;</span>
            <Icon icon="bi:calendar" class="panel-icon" width="14" height="14" aria-hidden="true" />
            <button class="panel-link panel-link--btn" @click="downloadIcs(node)">Download .ics</button>
          </div>

          <div class="panel-link-row">
            <Icon icon="bi:envelope-fill" class="panel-icon" width="14" height="14" aria-hidden="true" />
            <a :href="`mailto:${node.contact_email}`" class="panel-link">{{ node.contact_email }}</a>
          </div>
        </div>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.node-panel {
  position: fixed;
  top: 0;
  right: 0;
  height: 100%;
  width: clamp(320px, 40vw, 520px);
  background: var(--color-bg-panel);
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  z-index: var(--z-panel);
  transform: translateX(100%);
  transition: var(--transition-panel);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.node-panel--open {
  transform: translateX(0);
}

@media (max-width: 720px) {
  .node-panel {
    width: 100vw;
  }
}

.panel-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
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
}

.panel-close:hover {
  background: #f5f5f5;
}

.panel-content {
  padding: 3rem 1.5rem 2rem;
}

.panel-placeholder {
  background: #fffbea;
  border: 1px solid #e8b84b;
  border-radius: 4px;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  line-height: 1.45;
  margin-bottom: 1rem;
  color: #6b4c00;
}

.panel-unconfirmed {
  background: #e8f0fe;
  border: 1px solid #7baaf7;
  border-radius: 4px;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  line-height: 1.45;
  margin-bottom: 1rem;
  color: #1a3a6b;
}

.panel-unconfirmed a {
  color: inherit;
}

.panel-name {
  margin: 0 0 0.375rem;
  font-size: 1.375rem;
  font-weight: 600;
  line-height: 1.3;
  padding-right: 2.5rem;
}

.panel-meta {
  margin: 0 0 0.625rem;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.panel-venue {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  margin: 0 0 1.25rem;
  font-size: 0.9375rem;
}

.panel-icon {
  flex-shrink: 0;
  margin-top: 0.15em;
  color: var(--color-text-muted);
}

.panel-venue a {
  color: var(--color-text);
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
}

.panel-venue a:hover {
  text-decoration-style: solid;
}

.panel-description {
  margin-bottom: 1.5rem;
}

.panel-description p {
  margin: 0 0 0.75rem;
  font-size: 0.9375rem;
  line-height: 1.6;
}

.panel-links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid var(--color-border);
  padding-top: 1rem;
}

.panel-link-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.panel-link-sep {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.panel-link {
  color: var(--color-focus);
  font-size: 0.9375rem;
  text-decoration: none;
}

.panel-link:hover {
  text-decoration: underline;
}

.panel-link--btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: var(--font-family);
  font-size: 0.9375rem;
  text-align: left;
}
</style>
