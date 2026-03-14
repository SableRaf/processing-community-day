<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import { Icon } from '@iconify/vue';
import type { Node } from '../lib/nodes';
import { formatDateRange, formatTimeRange, calendarLinks, onlinePlatformName } from '../lib/format';
const props = defineProps<{
  node: Node | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const panelRef = ref<HTMLElement | null>(null);
const tabButtonRef = ref<HTMLButtonElement | null>(null);
const minimapRef = ref<HTMLDivElement | null>(null);
const calDropdownOpen = ref(false);
const shareDropdownOpen = ref(false);
const linkCopied = ref(false);
const descExpanded = ref(false);
const hostsExpanded = ref(false);
let trap: FocusTrap | null = null;
let minimap: import('leaflet').Map | null = null;

const PANEL_TRUNCATE_LENGTH = 200;
const HOSTS_VISIBLE = 3;

function handleOutsideClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (calDropdownOpen.value && !target.closest('.info-card-calendar-row')) {
    calDropdownOpen.value = false;
  }
  if (shareDropdownOpen.value && !target.closest('.share-btn-wrap')) {
    shareDropdownOpen.value = false;
  }
}

onMounted(() => {
  if (panelRef.value) {
    trap = createFocusTrap(panelRef.value, {
      initialFocus: () => {
        if (tabButtonRef.value && tabButtonRef.value.offsetParent !== null) {
          return tabButtonRef.value;
        }
        return panelRef.value!;
      },
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

  const L = (await import('leaflet')).default;

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
    tap: false,
  } as L.MapOptions & { tap: boolean });

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
    descExpanded.value = false;
    hostsExpanded.value = false;
    if (newNode) {
      trap?.activate();
      if (!newNode.online_event && !newNode.location_tbd) initMinimap(newNode);
      else destroyMinimap();
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
  const query = node.location_name
    ? [node.location_name, node.address].filter(Boolean).join(', ')
    : node.address ?? '';
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

function getParagraphs(text: string): string[] {
  return text.split(/\n\n+/).filter(Boolean);
}

function formatOrganizers(organizers: { name: string }[], expanded = false): string {
  const names = organizers.map(o => o.name).filter(Boolean);
  if (expanded || names.length <= HOSTS_VISIBLE) return names.join(', ');
  return names.slice(0, HOSTS_VISIBLE).join(', ');
}

function hasMoreHosts(organizers: { name: string }[]): boolean {
  return organizers.map(o => o.name).filter(Boolean).length > HOSTS_VISIBLE;
}

function getDescPreview(node: Node): { text: string; hasMore: boolean } {
  const full = node.details_text || '';
  const paras = getParagraphs(full);
  const first = paras[0] ?? '';
  const truncated = first.length > PANEL_TRUNCATE_LENGTH
    ? first.slice(0, PANEL_TRUNCATE_LENGTH).trimEnd() + '…'
    : first;
  return { text: truncated, hasMore: paras.length > 1 || first.length > PANEL_TRUNCATE_LENGTH };
}

function getShareUrl(node: Node): string {
  return `${window.location.origin}${window.location.pathname}?event=${node.id}`;
}

async function copyLink(node: Node) {
  try { await navigator.clipboard.writeText(getShareUrl(node)); } catch { /* unavailable */ }
  linkCopied.value = true;
  shareDropdownOpen.value = false;
  setTimeout(() => { linkCopied.value = false; }, 2000);
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
      v-if="node !== null"
      ref="tabButtonRef"
      class="panel-tab"
      aria-label="Close event details"
      @click="emit('close')"
    >
      <Icon icon="bi:chevron-right" width="20" height="20" aria-hidden="true" />
    </button>

    <div class="panel-scroll">
    <template v-if="node">
      <div class="panel-mobile-back">
        <button class="panel-back-btn" @click="emit('close')">
          <Icon icon="bi:chevron-left" width="16" height="16" aria-hidden="true" />
          Back to map
        </button>
      </div>
      <div class="panel-content">
        <div v-if="node.placeholder" class="panel-placeholder">
          ⚠ This is placeholder data. No real event has been confirmed at this location.
        </div>

        <div class="panel-header-row">
          <h2 id="panel-title" class="panel-name">{{ node.event_name }}</h2>
          <div class="share-btn-wrap">
            <button
              class="quick-action-btn"
              :aria-label="linkCopied ? 'Link copied!' : 'Share event'"
              :title="linkCopied ? 'Link copied!' : 'Share event'"
              @click.stop="shareDropdownOpen = !shareDropdownOpen"
            >
              <Icon v-if="!linkCopied" icon="bi:box-arrow-up" width="20" height="20" aria-hidden="true" />
              <Icon v-else icon="bi:check-lg" width="20" height="20" aria-hidden="true" />
            </button>
            <div v-show="shareDropdownOpen" class="quick-action-menu share-menu" role="menu">
              <button role="menuitem" class="copy-link-btn" @click="copyLink(node)">
                <Icon icon="bi:copy" width="14" height="14" aria-hidden="true" />
                Copy link
              </button>
              <hr class="share-menu-divider" />
              <a
                :href="`https://mastodon.social/share?text=${encodeURIComponent('Join me at ' + node.event_name + ' ' + getShareUrl(node))}`"
                target="_blank" rel="noopener noreferrer" role="menuitem"
                @click="shareDropdownOpen = false"
              >Share on Mastodon</a>
              <a
                :href="`https://bsky.app/intent/compose?text=${encodeURIComponent('Join me at ' + node.event_name + ' ' + getShareUrl(node))}`"
                target="_blank" rel="noopener noreferrer" role="menuitem"
                @click="shareDropdownOpen = false"
              >Share on Bluesky</a>
              <a
                :href="`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl(node))}`"
                target="_blank" rel="noopener noreferrer" role="menuitem"
                @click="shareDropdownOpen = false"
              >Share on Facebook</a>
              <a
                :href="`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getShareUrl(node))}`"
                target="_blank" rel="noopener noreferrer" role="menuitem"
                @click="shareDropdownOpen = false"
              >Share on LinkedIn</a>
            </div>
          </div>
        </div>
        <div class="panel-byline">
          <p v-if="node.organization_name" class="panel-organizing-entity">
            <span class="panel-label">by</span> {{ node.organization_name }}
          </p>
          <p v-if="node.organizers.some(o => o.name)" class="panel-hosts">
            <span class="panel-label">Hosts:</span>
            <span v-if="!hostsExpanded" class="panel-hosts-line">
              <span class="panel-hosts-names">{{ formatOrganizers(node.organizers, false) }}</span><template v-if="hasMoreHosts(node.organizers)"><span class="panel-hosts-more-wrap">…&nbsp;<button class="panel-hosts-more" @click="hostsExpanded = true">more</button></span></template>
            </span>
            <span v-else>{{ formatOrganizers(node.organizers, true) }}</span>
          </p>
        </div>

        <!-- Info Card -->
        <div class="panel-info-card">
          <!-- Row 1: Date/time -->
          <div class="info-card-row">
            <Icon icon="bi:calendar-event" width="18" height="18" aria-hidden="true" class="info-card-icon" />
            <div>
              <span v-if="node.date_tbd" class="info-card-date info-card-tbd">Date TBD</span>
              <span v-else class="info-card-date">{{ formatDateRange(node.event_date ?? '', node.event_end_date) }}</span>
              <span v-if="!node.date_tbd && node.time_tbd" class="info-card-time info-card-tbd">· Time TBD</span>
              <span v-else-if="!node.date_tbd && node.event_start_time" class="info-card-time">
                · {{ formatTimeRange(node.event_start_time, node.event_end_time) }}
              </span>
              <span v-if="!node.date_tbd && node.event_start_time" class="info-card-time-note">Local time</span>
            </div>
          </div>
          <hr class="info-card-divider" aria-hidden="true" />

          <!-- Row 2: Venue + address (OSM link) or Online platform -->
          <div class="info-card-row info-card-venue-row">
            <div class="info-card-row-leading">
              <Icon icon="bi:link-45deg" width="18" height="18" aria-hidden="true" class="info-card-icon" />
              <div class="info-card-venue">
                <span class="info-card-venue-name">{{ node.online_event ? onlinePlatformName(node.event_url) : node.location_tbd ? 'Location TBD' : (node.location_name || node.address) }}</span>
                <a
                  v-if="node.online_event && node.event_url"
                  :href="node.event_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="info-card-venue-address"
                  title="Join the online event"
                >{{ node.event_url }}</a>
                <a
                  v-else-if="!node.online_event && !node.location_tbd && node.address"
                  :href="getOsmUrl(node)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="info-card-venue-address"
                  title="Get directions on OpenStreetMap"
                >{{ node.location_name ? node.address : 'View on OpenStreetMap' }}</a>
              </div>
            </div>
            <p v-if="node.online_event" class="panel-online-badge info-card-online-badge">
              <Icon icon="bi:wifi" width="13" height="13" aria-hidden="true" />
              Online Event
            </p>
          </div>
          <hr class="info-card-divider" aria-hidden="true" />

          <!-- Row 3: Add to calendar (hidden when date is TBD) -->
          <div v-if="!node.date_tbd" class="info-card-row info-card-calendar-row">
            <Icon icon="bi:calendar-plus" width="18" height="18" aria-hidden="true" class="info-card-icon" />
            <div class="info-card-cal-trigger-wrap">
              <button
                class="info-card-cal-trigger"
                title="Add to calendar"
                @click.stop="calDropdownOpen = !calDropdownOpen"
              >
                Add to calendar
              </button>
              <div v-show="calDropdownOpen" class="quick-action-menu" role="menu">
                <a
                  :href="calendarLinks(node).googleCalUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  @click="calDropdownOpen = false"
                >Google Calendar</a>
                <a
                  :href="calendarLinks(node).outlookCalUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  @click="calDropdownOpen = false"
                >Outlook</a>
                <button role="menuitem" @click="downloadIcs(node); calDropdownOpen = false">
                  Download .ics
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Minimap (hidden for online events and TBD locations) -->
        <div v-if="!node.online_event && !node.location_tbd" class="panel-minimap-wrap" aria-hidden="true">
          <div ref="minimapRef" class="panel-minimap"></div>
          <div class="panel-minimap-shield"></div>
        </div>

        <!-- Description -->
        <div class="panel-description">
          <template v-if="descExpanded">
            <p
              v-for="(para, i) in getParagraphs(node.details_text)"
              :key="i"
            >{{ para }}</p>
          </template>
          <template v-else>
            <p>{{ getDescPreview(node).text }}</p>
          </template>
          <button
            v-if="getDescPreview(node).hasMore"
            class="panel-read-more"
            @click="descExpanded = !descExpanded"
          >
            {{ descExpanded ? 'Show less' : 'Read more…' }}
          </button>
        </div>

        <!-- Links section -->
        <div v-if="node.event_website || node.primary_contact.email" class="panel-links">
          <hr class="panel-separator" aria-hidden="true" />
          <a
            v-if="!node.online_event && !node.location_tbd"
            :href="getOsmUrl(node)"
            target="_blank"
            rel="noopener noreferrer"
            class="panel-link-row"
            title="Get directions on OpenStreetMap"
          >
            <Icon icon="bi:map" width="16" height="16" aria-hidden="true" class="panel-link-icon" />
            <span>Get directions</span>
          </a>
<a
            v-if="node.primary_contact.email"
            :href="`mailto:${node.primary_contact.email}`"
            class="panel-link-row"
            :title="`Email ${node.primary_contact.email}`"
          >
            <Icon icon="bi:envelope" width="16" height="16" aria-hidden="true" class="panel-link-icon" />
            <span>{{ node.primary_contact.email }}</span>
          </a>
          <a
            v-if="node.event_website"
            :href="node.event_website"
            target="_blank"
            rel="noopener noreferrer"
            class="panel-link-row"
            :title="`Visit ${node.event_website}`"
          >
            <Icon icon="bi:globe" width="16" height="16" aria-hidden="true" class="panel-link-icon" />
            <span>{{ node.event_website }}</span>
          </a>
        </div>
      </div>
    </template>
    </div>
  </aside>
</template>

<style scoped>
.node-panel {
  position: fixed;
  top: 0;
  right: 0;
  height: 100%;
  width: clamp(320px, 40vw, 520px);
  background: transparent;
  filter: drop-shadow(-4px 0 16px rgba(0, 0, 0, 0.18));
  z-index: var(--z-panel);
  transform: translateX(100%);
  transition: var(--transition-panel);
  overflow: visible;
  display: flex;
  flex-direction: column;
}

.node-panel--open {
  transform: translateX(0);
}

.panel-scroll {
  flex: 1;
  overflow-y: auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-panel);
  position: relative;
  z-index: 1;
}

.panel-tab {
  --tab-r: 12px;
  position: absolute;
  left: 1px;
  top: 50%;
  transform: translate(-100%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 96px;
  background: var(--color-bg-popup);
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 0;
  z-index: 0;
  /* drop-shadow renders along the clipped shape outline, acting as a border */
  filter: drop-shadow(-1px 0 0 var(--color-border))
          drop-shadow(0 -1px 0 var(--color-border))
          drop-shadow(0 1px 0 var(--color-border));
  transition: background-color 0.12s ease, color 0.12s ease, filter 0.12s ease;
  clip-path: shape(
    /*
     * Vertical tab, right edge meets the panel.
     * Adapted from the horizontal tab example by rotating 90° CW:
     * concave corners on the right, convex on the left.
     */
    from top right,
    /* 1. Concave top-right */
    curve to calc(100% - var(--tab-r)) var(--tab-r)
      with 100% var(--tab-r),
    /* 2. Top edge ← */
    hline to var(--tab-r),
    /* 3. Convex top-left */
    curve to 0 calc(var(--tab-r) * 2)
      with 0 var(--tab-r),
    /* 4. Left edge ↓ */
    vline to calc(100% - calc(var(--tab-r) * 2)),
    /* 5. Convex bottom-left */
    curve to var(--tab-r) calc(100% - var(--tab-r))
      with 0 calc(100% - var(--tab-r)),
    /* 6. Bottom edge → */
    hline to calc(100% - var(--tab-r)),
    /* 7. Concave bottom-right */
    curve to 100% 100%
      with 100% calc(100% - var(--tab-r))
  );

  @supports not (clip-path: shape(from top left, hline to 0)) {
    left: 4px;
    border: 1px solid var(--color-border);
    border-right: none;
    border-radius: 12px 0 0 12px;
    clip-path: none;
  }
}

.panel-tab:hover {
  background: var(--color-bg-popup-hover);
  color: var(--color-text);
}

.panel-tab:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.panel-mobile-back {
  display: none;
  padding: 0.75rem 1rem 0.625rem;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--color-bg-panel);
  border-bottom: 1px solid var(--color-border);
}

.panel-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: none;
  padding: 0.25rem 0;
  cursor: pointer;
  font-family: var(--font-family);
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.panel-back-btn:hover {
  color: var(--color-text);
}

@media (max-width: 720px) {
  .node-panel {
    width: 100vw;
    overflow: hidden;
  }
  .panel-tab {
    display: none;
  }
  .panel-mobile-back {
    display: block;
  }
}

.panel-content {
  padding: 1.5rem 1.5rem 2rem;
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


.panel-header-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.panel-byline {
  margin-bottom: 1.25rem;
}

.panel-name {
  flex: 1;
  min-width: 0;
  margin: 0 0 0.2rem;
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.3;
}

.panel-online-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  margin: 0 0 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
  border-radius: 4px;
  padding: 0.2em 0.55em;
}

.info-card-online-badge {
  margin: 0;
  align-self: flex-start;
  white-space: nowrap;
}

.info-card-tbd {
  font-style: italic;
  color: var(--color-text-muted);
}

.panel-organizing-entity {
  margin: 0 0 0.125rem;
  font-size: 0.875rem;
  color: var(--color-text);
}

.panel-hosts {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text);
  display: flex;
  align-items: baseline;
  gap: 0.3em;
  overflow: hidden;
}

.panel-label {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.panel-hosts-line {
  display: flex;
  align-items: baseline;
  min-width: 0;
  flex: 1;
}

.panel-hosts-names {
  overflow: hidden;
  white-space: nowrap;
  min-width: 0;
  flex-shrink: 1;
}

.panel-hosts-more-wrap {
  flex-shrink: 0;
  white-space: nowrap;
}

.panel-hosts-more {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: var(--font-family);
  font-size: inherit;
  color: var(--color-link);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.panel-hosts-more:hover {
  color: var(--color-link-hover);
}

/* ─── Info Card ─── */
.panel-info-card {
  margin-bottom: 1.25rem;
}

.info-card-row {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
}

.info-card-row-leading {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  flex: 1;
}

.info-card-row.info-card-venue-row {
  justify-content: space-between;
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

.info-card-time-note {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  opacity: 0.7;
  margin-left: 0.25em;
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
  text-decoration: none;
}

.info-card-venue-address:hover {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
  color: var(--color-text);
}

/* ─── Calendar row inside info card ─── */
.info-card-calendar-row {
  position: relative;
}

.info-card-cal-trigger-wrap {
  position: relative;
}

.info-card-cal-trigger {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: var(--font-family);
  font-size: 0.9375rem;
  color: var(--color-text);
  line-height: 1.45;
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ─── Calendar dropdown menu ─── */
.quick-action-menu {
  position: absolute;
  left: 0;
  z-index: 1001;
  top: calc(100% + 4px);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 4px;
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.quick-action-menu a,
.quick-action-menu button {
  display: flex;
  align-items: center;
  gap: 6px;
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

/* ─── Minimap ─── */
.panel-minimap-wrap {
  position: relative;
  width: calc(100% + 3rem);
  margin-left: -1.5rem;
  aspect-ratio: 18 / 9;
  margin-bottom: 1.25rem;
  overflow: hidden;
}

.panel-minimap {
  width: 100%;
  height: 100%;
}

.panel-minimap-shield {
  position: absolute;
  inset: 0;
  z-index: 1000;
}

.share-btn-wrap {
  position: relative;
}

.share-menu {
  right: 0;
  left: auto;
  top: calc(100% + 4px);
}

.share-menu-divider {
  margin: 4px -4px 4px;
  border: none;
  border-top: 1px solid var(--color-border);
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

/* ─── Description ─── */
.panel-description {
  margin-bottom: 1rem;
}

.panel-description p {
  margin: 0 0 0.75rem;
  font-size: 0.9375rem;
  line-height: 1.6;
}

.panel-read-more {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: var(--font-family);
  font-size: 0.875rem;
  color: var(--color-link);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.panel-read-more:hover {
  color: var(--color-link-hover);
}

/* ─── Links section ─── */
.panel-links {
  margin-bottom: 1.5rem;
}

.panel-separator {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 0 0 0.75rem;
}

.panel-link-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0;
  text-decoration: none;
  color: var(--color-text);
  font-size: 0.875rem;
  overflow: hidden;
}

.panel-link-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-link-row:hover {
  color: var(--color-link);
}

.panel-link-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
}
</style>
