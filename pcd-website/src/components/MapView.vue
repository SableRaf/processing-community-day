<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Node } from '../lib/nodes';
import { makePopupContent } from '../lib/popup';
import NodePanel from './NodePanel.vue';
import NodeList from './NodeList.vue';

const props = defineProps<{
  nodes: Node[];
}>();

const selectedNode = ref<Node | null>(null);
const listOpen = ref(false);

let mapInstance: import('leaflet').Map | null = null;
let leafletRef: typeof import('leaflet') | null = null;
const markerMap = new Map<string, import('leaflet').Marker>();

// --- Tile style config ---
interface TileLayerConfig { url: string; options: Record<string, unknown>; }
interface MapStyle { id: string; label: string; layers: TileLayerConfig[]; }

const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const ESRI_ATTR = 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community';

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
  {
    id: 'fun',
    label: 'Fun',
    layers: [{
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
      options: { attribution: ESRI_ATTR, maxZoom: 16 },
    }],
  },
];

const STORAGE_KEY = 'pcd-map-style';
let activeTileLayers: import('leaflet').TileLayer[] = [];

const currentStyle = ref<string>('');
const availableStyles = computed(() => MAP_STYLES.map(s => ({ id: s.id, label: s.label })));

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

function onStyleChange(styleId: string) {
  if (mapInstance && leafletRef) setMapStyle(styleId, mapInstance, leafletRef);
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

function onNodeSelect(node: Node) {
  selectedNode.value = null;

  const marker = markerMap.get(node.id);
  if (mapInstance && marker) {
    mapInstance.flyTo([node.lat, node.lng], 5, { duration: 1 });
    setTimeout(() => {
      marker.openPopup();
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
    }
  } else if (e.key === 'M' || e.key === 'm') {
    if (!isTextInput) {
      const mapEl = document.getElementById('map');
      if (mapEl && (mapEl.contains(document.activeElement) || document.activeElement === mapEl)) {
        e.preventDefault();
        listOpen.value = !listOpen.value;
        if (listOpen.value) selectedNode.value = null;
      }
    }
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

  L.control.zoom({ position: 'bottomleft' }).addTo(map);

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
    const icon = node.online_event ? onlineMarkerIcon : markerIcon;
    const marker = L.marker([node.lat, node.lng], { icon });
    marker.bindPopup(() => makePopupContent(node), { maxWidth: 340 });
    markerMap.set(node.id, marker);
    clusterGroup.addLayer(marker);
  });

  map.addLayer(clusterGroup);

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
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  mapInstance?.remove();
});
</script>

<template>
  <div id="map" tabindex="-1" aria-label="World map of PCD 2026 nodes"></div>
  <a
    id="host-btn"
    href="https://github.com/SableRaf/pcd-website-mvp-2/issues/new?template=new-event.yml"
  >Submit your event</a>
  <button
    id="burger-btn"
    :aria-expanded="listOpen"
    :aria-label="listOpen ? 'Close node list' : 'Open node list'"
    @click="listOpen ? closeList() : openList()"
  >
    ☰
  </button>
  <NodePanel :node="selectedNode" @close="closePanel" />
  <NodeList
    :nodes="nodes"
    :open="listOpen"
    :current-style="currentStyle"
    :available-styles="availableStyles"
    @close="closeList"
    @select="onNodeSelect"
    @style-change="onStyleChange"
  />
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
