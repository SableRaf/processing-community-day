<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Node } from '../lib/nodes';
import { makePopupContent } from '../lib/popup';
import NodePanel from './NodePanel.vue';
import NodeList from './NodeList.vue';
import LanguageSwitcher from './LanguageSwitcher.vue';
import { SUBMIT_EVENT_URL } from '../config';
import { currentLocale } from '../i18n/localeState';
import { i18n } from '../i18n/index';

const props = defineProps<{
  nodes: Node[];
  initialEventId?: string;
}>();

const { t } = useI18n();

const selectedNode = ref<Node | null>(null);
const listOpen = ref(false);

let mapInstance: import('leaflet').Map | null = null;
let leafletRef: typeof import('leaflet') | null = null;
const markerMap = new Map<string, import('leaflet').Marker>();
const nodeMap = new Map<string, Node>(); // id → Node, for O(1) lookups
let openPopupNodeId: string | null = null;
let slidingWindowHandler: ((e: FocusEvent) => void) | null = null;

// --- Tile style config ---
interface TileLayerConfig { url: string; options: Record<string, unknown>; }
interface MapStyle { id: string; label: string; layers: TileLayerConfig[]; }

const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const MAP_STYLES: MapStyle[] = [
  {
    id: 'dark',
    label: 'Dark',
    layers: [
      {
        url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
        options: { attribution: CARTO_ATTR, subdomains: 'abcd', maxZoom: 20, detectRetina: true },
      },
      {
        url: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
        options: { attribution: CARTO_ATTR, subdomains: 'abcd', maxZoom: 20, detectRetina: true, tileSize: 512, zoomOffset: -1 },
      },
    ],
  },
  {
    id: 'light',
    label: 'Light',
    layers: [
      {
        url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
        options: { attribution: CARTO_ATTR, subdomains: 'abcd', maxZoom: 20, detectRetina: true },
      },
      {
        url: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
        options: { attribution: CARTO_ATTR, subdomains: 'abcd', maxZoom: 20, detectRetina: true, tileSize: 512, zoomOffset: -1 },
      },
    ],
  },
];

const STORAGE_KEY = 'pcd-map-style';
const SLIDING_WINDOW_MARGIN = 0.28; // 28% dead zone inset from each edge
let activeTileLayers: import('leaflet').TileLayer[] = [];
let themeTransitionTimer: number | null = null;

const currentStyle = ref<string>('');

function getInitialStyle(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && MAP_STYLES.find(s => s.id === stored)) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setMapStyle(styleId: string, map: import('leaflet').Map, L: typeof import('leaflet')) {
  const style = MAP_STYLES.find(s => s.id === styleId);
  if (!style) return;
  activeTileLayers.forEach(layer => map.removeLayer(layer));
  activeTileLayers = [];
  style.layers.forEach(cfg => {
    const layer = L.tileLayer(cfg.url, cfg.options);
    layer.addTo(map);
    activeTileLayers.push(layer);
  });
  currentStyle.value = styleId;
  localStorage.setItem(STORAGE_KEY, styleId);
  document.documentElement.dataset.theme = styleId === 'dark' ? 'dark' : 'light';
}

function animateThemeTransition() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  root.classList.add('theme-transition');
  if (themeTransitionTimer !== null) {
    window.clearTimeout(themeTransitionTimer);
  }
  themeTransitionTimer = window.setTimeout(() => {
    root.classList.remove('theme-transition');
    themeTransitionTimer = null;
  }, 360);
}

function toggleTheme() {
  const next = currentStyle.value === 'dark' ? 'light' : 'dark';
  if (mapInstance && leafletRef) {
    animateThemeTransition();
    setMapStyle(next, mapInstance, leafletRef);
  }
}

function setActiveMarker(nodeId: string | null) {
  markerMap.forEach((marker, id) => {
    marker.getElement()?.classList.toggle('marker-active', id === nodeId);
  });
}

function openPanel(node: Node) {
  selectedNode.value = node;
  listOpen.value = false;
  const marker = markerMap.get(node.id);
  marker?.closePopup();
  setActiveMarker(node.id);
}

function closePanel() {
  selectedNode.value = null;
  setActiveMarker(null);
}

function openList() {
  listOpen.value = true;
  selectedNode.value = null;
}

function closeList() {
  listOpen.value = false;
}

function panToKeepInView(lat: number, lng: number): void {
  if (!mapInstance) return;
  if (selectedNode.value !== null) return;
  if (openPopupNodeId !== null) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const containerPoint = mapInstance.latLngToContainerPoint([lat, lng]);
  const size = mapInstance.getSize();

  const mx = size.x * SLIDING_WINDOW_MARGIN;
  const my = size.y * SLIDING_WINDOW_MARGIN;

  let dx = 0;
  let dy = 0;

  if (containerPoint.x < mx)               dx = containerPoint.x - mx;
  else if (containerPoint.x > size.x - mx) dx = containerPoint.x - (size.x - mx);

  if (containerPoint.y < my)               dy = containerPoint.y - my;
  else if (containerPoint.y > size.y - my) dy = containerPoint.y - (size.y - my);

  if (dx !== 0 || dy !== 0) {
    mapInstance.panBy([dx, dy], {
      animate: !reduceMotion,
      duration: reduceMotion ? 0 : 0.3,
    });
  }
}

function onNodeSelect(node: Node) {
  selectedNode.value = null;

  const marker = markerMap.get(node.id);
  if (mapInstance && marker) {
    mapInstance.flyTo([node.lat, node.lng], 5, { duration: 1 });
    setTimeout(() => {
      openPanel(node);
    }, 1100);
  }
}

function handleKeydown(e: KeyboardEvent) {
  const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
  const isTextInput = tag === 'input' || tag === 'textarea' ||
    (document.activeElement as HTMLElement)?.isContentEditable;

  if (e.key === 'Escape') {
    if (selectedNode.value) {
      closePanel();
    } else if (listOpen.value) {
      closeList();
    } else if (openPopupNodeId && mapInstance) {
      e.stopPropagation(); // prevent Leaflet from also handling this Escape
      const marker = markerMap.get(openPopupNodeId);
      mapInstance.closePopup();
      marker?.getElement()?.focus();
    } else {
      const mapEl = document.getElementById('map');
      if (mapEl && mapEl.contains(document.activeElement) && document.activeElement !== mapEl) {
        e.preventDefault();
        mapEl.focus();
      } else if (mapEl && document.activeElement === mapEl) {
        e.preventDefault();
        document.getElementById('burger-btn')?.focus();
      }
    }
    return;
  }

  if (isTextInput) return;

  if (/^[0-9]$/.test(e.key)) {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === '0') {
      mapInstance?.setView([20, 10], 3);
    } else {
      mapInstance?.setZoom(parseInt(e.key));
    }
  } else if (e.key === '+' || e.key === '=' || e.key === 'Add') {
    e.preventDefault();
    e.stopPropagation();
    mapInstance?.zoomIn();
  } else if (e.key === '-' || e.key === 'Subtract') {
    e.preventDefault();
    e.stopPropagation();
    mapInstance?.zoomOut();
  } else if (e.key === 'M' || e.key === 'm') {
    e.preventDefault();
    listOpen.value = !listOpen.value;
    if (listOpen.value) selectedNode.value = null;
  } else if (e.key === 'L' || e.key === 'l') {
    e.preventDefault();
    document.getElementById('map')?.focus();
  }
}

onMounted(async () => {
  const L = (await import('leaflet')).default;
  await import('leaflet.markercluster');
  await import('@luomus/leaflet-smooth-wheel-zoom');

  const map = L.map('map', {
    zoomControl: false,
    scrollWheelZoom: false,
    smoothWheelZoom: true,
    smoothSensitivity: 1,
    minZoom: 1,
  });
  mapInstance = map;
  leafletRef = L;

  // Remove digit (48–57) and +/- keyCodes from Leaflet's built-in zoom handler
  // so our global shortcuts don't double-fire when the map is focused.
  const kb = (map as any).keyboard;
  if (kb?._zoomKeys) {
    for (let code = 48; code <= 57; code++) delete kb._zoomKeys[code];
    // +/= (187, 61) and -/_ (189, 173) — Leaflet's default zoom-in/out keys
    for (const code of [61, 173, 187, 189]) delete kb._zoomKeys[code];
  }

  L.control.zoom({ position: 'topleft' }).addTo(map);

  // Manage tab order for Leaflet-injected elements:
  // - Zoom buttons stay in tab order (they are our primary map keyboard controls)
  // - Attribution links stay in tab order but move to end of DOM (after markers)
  // - All other Leaflet controls are removed from tab order
  requestAnimationFrame(() => {
    document.querySelectorAll('.leaflet-control a, .leaflet-control button').forEach(el => {
      const inZoom = el.closest('.leaflet-control-zoom');
      const inAttribution = el.closest('.leaflet-control-attribution');
      if (!inZoom && !inAttribution) {
        el.setAttribute('tabindex', '-1');
      }
    });
    // Leaflet sets tabindex="0" on the map container — force it back to -1
    // so tab order flows through our own controls instead
    map.getContainer().setAttribute('tabindex', '-1');

    const mapContainer = map.getContainer();
    const controlContainer = mapContainer.querySelector('.leaflet-control-container');
    const mapPane = mapContainer.querySelector('.leaflet-map-pane');

    // Move zoom controls before the marker pane so screen readers and tab order
    // encounter zoom buttons before individual markers
    if (controlContainer && mapPane) {
      mapContainer.insertBefore(controlContainer, mapPane);
    }

    // Move attribution control to the very end of the map container so it
    // appears last in tab order (after all markers)
    const attribution = mapContainer.querySelector('.leaflet-control-attribution')?.closest('.leaflet-bottom');
    if (attribution) {
      mapContainer.appendChild(attribution);
    }

  });

  // Try to center on visitor's location, fall back to world view
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 5),
      () => map.setView([20, 10], 3),
      { timeout: 5000 }
    );
  } else {
    map.setView([20, 10], 3);
  }

  setMapStyle(getInitialStyle(), map, L);

  // Cluster group with Google Maps-style concentric circles
  const clusterGroup = (L as unknown as { markerClusterGroup: (opts?: object) => import('leaflet').LayerGroup }).markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    disableClusteringAtZoom: 4,
    iconCreateFunction: (cluster: { getChildCount: () => number }) => {
      const count = cluster.getChildCount();
      const r1 = 24, r2 = 18, r3 = 12;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${r1 * 2}" height="${r1 * 2}" viewBox="0 0 ${r1 * 2} ${r1 * 2}">
        <circle cx="${r1}" cy="${r1}" r="${r1}" fill="#5601A4" opacity="0.2"/>
        <circle cx="${r1}" cy="${r1}" r="${r2}" fill="#5601A4" opacity="0.3"/>
        <circle cx="${r1}" cy="${r1}" r="${r3}" fill="#5601A4" opacity="0.9"/>
        <text x="${r1}" y="${r1}" text-anchor="middle" dominant-baseline="central"
          font-family="IBM Plex Sans, system-ui, sans-serif" font-size="11" font-weight="600" fill="#fff">${count}</text>
      </svg>`;
      return L.divIcon({
        html: svg,
        className: 'marker-cluster-custom',
        iconSize: [r1 * 2, r1 * 2],
        iconAnchor: [r1, r1],
      });
    },
  });

  const markerIcon = L.divIcon({
    className: 'marker-node',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" fill="#5601A4" stroke="#fff" stroke-width="2"/>
    </svg>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });

  const onlineMarkerIcon = L.divIcon({
    className: 'marker-node marker-node--online',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
      <circle cx="11" cy="11" r="10" fill="#5601A4" stroke="#fff" stroke-width="2"/>
      <path d="M11 15.5a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" fill="#fff"/>
      <path d="M7.5 12.2a4.95 4.95 0 0 1 7 0" stroke="#fff" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      <path d="M5 9.7a8.0 8.0 0 0 1 12 0" stroke="#fff" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.7"/>
    </svg>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -13],
  });

  // Add markers
  props.nodes.forEach((node) => {
    nodeMap.set(node.id, node);
    const icon = node.online_event ? onlineMarkerIcon : markerIcon;
    const marker = L.marker([node.lat, node.lng], { icon });
    marker.bindPopup(() => makePopupContent(node), { maxWidth: 340 });
    markerMap.set(node.id, marker);
    clusterGroup.addLayer(marker);
  });

  map.addLayer(clusterGroup);

  // Apply accessible names to marker elements. Leaflet creates marker DOM elements
  // lazily, so we apply after layer is added and re-apply whenever the cluster
  // animates (which shows/hides individual markers as clusters form or dissolve).
  function applyMarkerLabels() {
    markerMap.forEach((marker, id) => {
      const node = nodeMap.get(id);
      if (node) {
        marker.getElement()?.setAttribute('aria-label', node.event_name);
      }
    });
  }

  // Sort the marker pane so cluster markers appear before individual markers
  // in the DOM, giving screen readers a logical order: clusters first, then nodes.
  function sortMarkerPane() {
    const pane = map.getPanes().markerPane;
    if (!pane) return;
    const clusters = Array.from(pane.querySelectorAll<HTMLElement>('.marker-cluster-custom'));
    const markers = Array.from(pane.querySelectorAll<HTMLElement>('.marker-node'));
    clusters.forEach(el => pane.appendChild(el));
    markers.forEach(el => pane.appendChild(el));
    clusters.forEach(el => pane.insertBefore(el, pane.firstChild));
  }

  // Watch the marker pane for DOM changes on initial load — marker elements are
  // created lazily by the cluster group after the first setView, so we can't
  // rely on a fixed timeout. Disconnect after the first batch of markers appear.
  const markerPane = map.getPanes().markerPane;
  if (markerPane) {
    const observer = new MutationObserver(() => {
      applyMarkerLabels();
      sortMarkerPane();
      observer.disconnect();
    });
    observer.observe(markerPane, { childList: true, subtree: false });
  }

  clusterGroup.on('animationend', () => { applyMarkerLabels(); sortMarkerPane(); });

  // When a cluster spiderfies, move its child marker elements immediately after
  // the cluster's own element in the DOM so screen readers encounter them next.
  clusterGroup.on('spiderfied', (e: { cluster: import('leaflet').Layer; markers: import('leaflet').Marker[] }) => {
    applyMarkerLabels();
    const pane = map.getPanes().markerPane;
    if (!pane) return;
    const clusterEl = (e.cluster as import('leaflet').Marker).getElement?.();
    if (!clusterEl) return;
    // Insert each child element right after the cluster element
    let insertAfter: Element = clusterEl;
    e.markers.forEach((m) => {
      const el = m.getElement?.();
      if (el && el !== insertAfter) {
        insertAfter.after(el);
        insertAfter = el;
      }
    });
    // Move focus to the first child marker so Tab continues from there
    const firstChildEl = e.markers[0]?.getElement?.();
    firstChildEl?.focus();
  });

  // Sliding window: pan just enough to keep focused markers in the safe zone
  slidingWindowHandler = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('marker-node')) return;

    let foundNode: Node | undefined;
    for (const [id, marker] of markerMap) {
      if (marker.getElement() === target) {
        foundNode = nodeMap.get(id);
        break;
      }
    }

    if (foundNode) {
      const lat = foundNode.lat;
      const lng = foundNode.lng;
      // Defer past Leaflet's own focus/keyboard handlers that may pan synchronously
      requestAnimationFrame(() => panToKeepInView(lat, lng));
    }
  };
  map.getContainer().addEventListener('focusin', slidingWindowHandler);

  // Move focus into popup content when it opens
  map.on('popupopen', (e) => {
    const container = e.popup.getElement();
    if (!container) return;
    // Track which node's popup is open
    const btn = container.querySelector<HTMLElement>('.read-more');
    openPopupNodeId = btn?.getAttribute('data-node-id') ?? null;
    const focusTarget = container.querySelector<HTMLElement>('button, a, [tabindex]');
    focusTarget?.focus();
  });

  map.on('popupclose', () => {
    openPopupNodeId = null;
  });

  // Delegated click for .read-more buttons in popups
  const mapEl = document.getElementById('map');
  if (mapEl) {
    mapEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('a')) return; // let icon links open without triggering panel
      const btn = target.closest('.read-more');
      if (btn) {
        const nodeId = btn.getAttribute('data-node-id');
        if (nodeId) {
          const node = props.nodes.find((n) => n.id === nodeId);
          if (node) openPanel(node);
        }
      }
    });
  }

  // Global keyboard shortcuts
  document.addEventListener('keydown', handleKeydown);

  // Deep link: ?event=<node-id> auto-opens the panel for that event
  const eventId = props.initialEventId ?? new URLSearchParams(window.location.search).get('event');
  if (eventId) {
    const node = props.nodes.find((n) => n.id === eventId || n.uid === eventId);
    if (node) openPanel(node);
  }

  // Update document-level text when locale changes
  watch(currentLocale, () => {
    document.title = i18n.global.t('page.title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', i18n.global.t('page.description'));
    const skipLink = document.getElementById('skip-link');
    if (skipLink) skipLink.textContent = i18n.global.t('page.skip_to_map');
  }, { immediate: true });
});

onUnmounted(() => {
  if (themeTransitionTimer !== null) {
    window.clearTimeout(themeTransitionTimer);
  }
  document.documentElement.classList.remove('theme-transition');
  document.removeEventListener('keydown', handleKeydown);
  if (slidingWindowHandler && mapInstance) {
    mapInstance.getContainer().removeEventListener('focusin', slidingWindowHandler);
    slidingWindowHandler = null;
  }
  mapInstance?.remove();
});
</script>

<template>
  <div role="banner">
  <button
    id="burger-btn"
    :aria-expanded="listOpen"
    :aria-label="listOpen ? t('nav.close_node_list') : t('nav.open_node_list')"
    @click="listOpen ? closeList() : openList()"
  >
    ☰
  </button>
  <div class="banner-controls-left">
    <LanguageSwitcher />
  </div>
  <a
    id="host-btn"
    :href="SUBMIT_EVENT_URL"
  >{{ t('nav.submit_event') }}</a>
  <div class="banner-controls-right">
    <button
      id="theme-toggle"
      role="switch"
      :aria-checked="currentStyle === 'dark'"
      :aria-label="currentStyle === 'dark' ? t('nav.switch_to_light') : t('nav.switch_to_dark')"
      :title="currentStyle === 'dark' ? t('nav.switch_to_light') : t('nav.switch_to_dark')"
      @click="toggleTheme"
    >
      <span class="theme-toggle__track" aria-hidden="true">
        <span class="theme-toggle__thumb"></span>
        <span class="theme-toggle__icon theme-toggle__icon--sun">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
        </span>
        <span class="theme-toggle__icon theme-toggle__icon--moon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </span>
      </span>
    </button>
  </div>
  </div>
  <NodePanel :node="selectedNode" @close="closePanel" />
  <NodeList
    :nodes="nodes"
    :open="listOpen"
    @close="closeList"
    @select="onNodeSelect"
  />
  <div id="map" tabindex="-1" :aria-label="t('map.aria_label')"></div>
</template>

<style scoped>
#map {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
}

.banner-controls-right {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: var(--z-controls);
  display: flex;
  align-items: center;
}

.banner-controls-left {
  position: fixed;
  top: 1rem;
  left: calc(1rem + 44px + 0.5rem);
  z-index: var(--z-controls);
  display: flex;
  align-items: center;
}

#theme-toggle {
  width: 73px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--color-bg-popup) 86%, transparent);
  border: 2px solid var(--color-border);
  border-radius: 999px;
  cursor: pointer;
  color: var(--color-text);
  transition: background-color 0.28s ease, color 0.28s ease, border-color 0.28s ease, box-shadow 0.28s ease;
  box-shadow: 0 10px 28px rgba(18, 19, 33, 0.18);
  backdrop-filter: blur(14px);
}

#theme-toggle:hover {
  background: var(--color-bg-popup-hover);
}

#theme-toggle:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.theme-toggle__track {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  padding: 4px;
  transform: translate(0, -1px);
}

.theme-toggle__thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: linear-gradient(135deg, #f7d76d 0%, #f3c84d 48%, #ecaa2a 100%);
  box-shadow: 0 8px 18px rgba(124, 79, 10, 0.32);
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), background 0.32s ease, box-shadow 0.32s ease;
}

.theme-toggle__icon {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  justify-self: center;
  color: var(--color-text-muted);
  transition: color 0.24s ease, opacity 0.24s ease;
}

.theme-toggle__icon--sun {
  transform: translateX(-1px);
}

.theme-toggle__icon--moon {
  transform: translateX(3px);
}

#theme-toggle[aria-checked="false"] .theme-toggle__icon--sun,
#theme-toggle[aria-checked="true"] .theme-toggle__icon--moon {
  color: #241336;
  opacity: 1;
}

#theme-toggle[aria-checked="false"] .theme-toggle__icon--moon,
#theme-toggle[aria-checked="true"] .theme-toggle__icon--sun {
  opacity: 0.68;
}

#theme-toggle[aria-checked="true"] .theme-toggle__thumb {
  transform: translateX(33px);
  background: linear-gradient(135deg, #d8b4fe 0%, #c084fc 44%, #9d4edd 100%);
  box-shadow: 0 8px 18px rgba(88, 28, 135, 0.34);
}

#theme-toggle[aria-checked="true"] {
  background: color-mix(in srgb, var(--color-bg-popup) 78%, #0b1024 22%);
}

#theme-toggle[aria-checked="true"]:hover {
  background: color-mix(in srgb, var(--color-bg-popup-hover) 76%, #0b1024 24%);
}

@media (prefers-reduced-motion: reduce) {
  #theme-toggle,
  .theme-toggle__thumb,
  .theme-toggle__icon {
    transition: none;
  }
}
</style>

<style>
.marker-node.marker-active svg {
  overflow: visible;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 10px rgba(86, 1, 164, 0.9));
  transform: scale(1.4);
  transform-origin: center;
}

.marker-node.marker-active svg circle {
  stroke-width: 3.5;
}
</style>
