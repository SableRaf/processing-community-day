<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import { Icon } from '@iconify/vue';
import type { Node } from '../lib/nodes';
import { formatDateRange, formatTimeRange, calendarLinks } from '../lib/format';
import L from 'leaflet';

const props = defineProps<{
  node: Node | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const panelRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);
const minimapRef = ref<HTMLDivElement | null>(null);
const calDropdownOpen = ref(false);
let trap: FocusTrap | null = null;
let minimap: L.Map | null = null;

function handleOutsideClick(e: MouseEvent) {
  if (calDropdownOpen.value) {
    const target = e.target as HTMLElement;
    if (!target.closest('.quick-action-dropdown')) {
      calDropdownOpen.value = false;
    }
  }
}

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
  document.addEventListener('click', handleOutsideClick);
});

onUnmounted(() => {
  trap?.deactivate();
  destroyMinimap();
  document.removeEventListener('click', handleOutsideClick);
});

function destroyMinimap() {
  if (minimap) {
    minimap.remove();
    minimap = null;
  }
}

async function initMinimap(node: Node) {
  await nextTick();
  if (!minimapRef.value) return;
  destroyMinimap();

  minimap = L.map(minimapRef.value, {
    center: [node.lat, node.lng],
    zoom: 16,
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(minimap);

  const pinIcon = L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="#3b5fc0"/>
      <circle cx="14" cy="14" r="5.5" fill="#ffffff"/>
    </svg>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  });
  L.marker([node.lat, node.lng], { icon: pinIcon }).addTo(minimap);
}

watch(
  () => props.node,
  (newNode) => {
    calDropdownOpen.value = false;
    if (newNode) {
      trap?.activate();
      initMinimap(newNode);
    } else {
      trap?.deactivate();
      destroyMinimap();
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

        <div class="panel-info-row">
          <!-- Event Info Card -->
          <div class="panel-info-card">
            <div class="info-card-row">
              <Icon icon="bi:calendar-event" width="18" height="18" aria-hidden="true" class="info-card-icon" />
              <div>
                <span class="info-card-date">{{ formatDateRange(node.start_date, node.end_date) }}</span>
                <span v-if="node.start_time" class="info-card-time">
                  · {{ formatTimeRange(node.start_time, node.end_time, node.timezone) }}
                </span>
              </div>
            </div>
            <hr class="info-card-divider" aria-hidden="true" />
            <div class="info-card-row">
              <Icon icon="bi:geo-alt-fill" width="18" height="18" aria-hidden="true" class="info-card-icon" />
              <div class="info-card-venue">
                <span class="info-card-venue-name">{{ node.venue }}</span>
                <span class="info-card-venue-address">{{ node.address || `${node.city}, ${node.country}` }}</span>
              </div>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="panel-quick-actions">
            <!-- Calendar: dropdown -->
            <div class="quick-action-dropdown" :class="{ open: calDropdownOpen }">
              <button
                class="quick-action-btn"
                aria-label="Add to calendar"
                @click.stop="calDropdownOpen = !calDropdownOpen"
              >
                <Icon icon="bi:calendar-plus" width="20" height="20" aria-hidden="true" />
              </button>
              <div class="quick-action-menu" role="menu">
                <a
                  :href="calendarLinks(node).googleCalUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  @click="calDropdownOpen = false"
                >Google Calendar</a>
                <button role="menuitem" @click="downloadIcs(node); calDropdownOpen = false">
                  Download .ics
                </button>
              </div>
            </div>

            <!-- Directions -->
            <a
              :href="getOsmUrl(node)"
              target="_blank"
              rel="noopener noreferrer"
              class="quick-action-btn"
              aria-label="Get directions (OpenStreetMap)"
            >
              <Icon icon="bi:map" width="20" height="20" aria-hidden="true" />
            </a>

            <!-- Email -->
            <a
              v-if="node.contact_email"
              :href="`mailto:${node.contact_email}`"
              class="quick-action-btn"
              aria-label="Email organiser"
            >
              <Icon icon="bi:envelope-fill" width="20" height="20" aria-hidden="true" />
            </a>

            <!-- Website -->
            <a
              v-if="node.website"
              :href="node.website"
              target="_blank"
              rel="noopener noreferrer"
              class="quick-action-btn"
              aria-label="Visit event website"
            >
              <Icon icon="bi:globe" width="20" height="20" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div ref="minimapRef" class="panel-minimap" aria-hidden="true"></div>

        <div class="panel-description">
          <p
            v-for="(para, i) in getParagraphs(node.long_description || node.short_description)"
            :key="i"
          >{{ para }}</p>
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
  background: var(--color-border);
}

.panel-content {
  padding: 3rem 1.5rem 2rem;
}

.panel-placeholder {
  background: var(--color-callout-placeholder-bg);
  border: 1px solid var(--color-callout-placeholder-border);
  border-radius: 4px;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  line-height: 1.45;
  margin-bottom: 1rem;
  color: var(--color-callout-placeholder-text);
}

.panel-unconfirmed {
  background: var(--color-callout-unconfirmed-bg);
  border: 1px solid var(--color-callout-unconfirmed-border);
  border-radius: 4px;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  line-height: 1.45;
  margin-bottom: 1rem;
  color: var(--color-callout-unconfirmed-text);
}

.panel-unconfirmed a {
  color: inherit;
}

.panel-name {
  margin: 0 0 1rem;
  font-size: 1.375rem;
  font-weight: 600;
  line-height: 1.3;
  padding-right: 2.5rem;
}

/* ─── Info Row: card + quick actions ─── */
.panel-info-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.panel-info-card {
  flex: 1;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 16px 20px;
  background: var(--color-bg-panel);
  min-width: 0;
}

.info-card-row {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
}

.info-card-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.info-card-date {
  font-size: 0.9375rem;
  color: var(--color-text);
  line-height: 1.45;
}

.info-card-time {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.info-card-divider {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 14px 0;
}

.info-card-venue {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.info-card-venue-name {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text);
  line-height: 1.35;
}

.info-card-venue-address {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

/* ─── Quick Actions ─── */
.panel-quick-actions {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex-shrink: 0;
}

.quick-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-panel);
  color: var(--color-text-muted);
  cursor: pointer;
  text-decoration: none;
  font-family: var(--font-family);
  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.quick-action-btn:hover {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

/* Calendar dropdown */
.quick-action-dropdown {
  position: relative;
}

.quick-action-menu {
  display: none;
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 4px;
  min-width: 160px;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.quick-action-dropdown.open .quick-action-menu {
  display: flex;
  flex-direction: column;
}

.quick-action-menu a,
.quick-action-menu button {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  font-size: 0.875rem;
  color: var(--color-text);
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 4px;
  font-family: var(--font-family);
}

.quick-action-menu a:hover,
.quick-action-menu button:hover {
  background: var(--color-border);
}

@media (max-width: 400px) {
  .panel-info-row {
    flex-direction: column;
  }

  .panel-quick-actions {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .quick-action-menu {
    right: auto;
    left: 0;
  }
}

.panel-minimap {
  width: calc(100% + 3rem);
  margin-left: -1.5rem;
  aspect-ratio: 18 / 9;
  margin-bottom: 1.25rem;
  overflow: hidden;
}

.panel-description {
  margin-bottom: 1.5rem;
}

.panel-description p {
  margin: 0 0 0.75rem;
  font-size: 0.9375rem;
  line-height: 1.6;
}
</style>
