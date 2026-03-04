<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
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
const markerMap = new Map<string, import('leaflet').Marker>();

function openPanel(node: Node) {
  selectedNode.value = node;
  listOpen.value = false;
}

function closePanel() {
  selectedNode.value = null;
}

function openList() {
  listOpen.value = true;
  selectedNode.value = null;
}

function closeList() {
  listOpen.value = false;
}

function onNodeSelect(node: Node) {
  listOpen.value = false;
  selectedNode.value = null;

  const marker = markerMap.get(node.id);
  if (mapInstance && marker) {
    mapInstance.flyTo([node.lat, node.lng], 12, { duration: 1 });
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
    zoomControl: true,
    scrollWheelZoom: false,
    smoothWheelZoom: true,
    smoothSensitivity: 1,
    minZoom: 1,
  });
  mapInstance = map;

  map.setView([20, 10], 3);

  // CartoDB light-no-labels tile layer (monochrome, no POI)
  const tileLayer = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }
  );
  tileLayer.addTo(map);

  // Cluster group with Google Maps-style concentric circles
  const clusterGroup = (L as unknown as { markerClusterGroup: (opts?: object) => import('leaflet').LayerGroup }).markerClusterGroup({
    showCoverageOnHover: false,
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

  // Custom red SVG marker
  const markerIcon = L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" fill="#5601A4" stroke="#fff" stroke-width="2"/>
    </svg>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });

  // Add markers
  props.nodes.forEach((node) => {
    const marker = L.marker([node.lat, node.lng], { icon: markerIcon });
    marker.bindPopup(() => makePopupContent(node), { maxWidth: 340 });
    markerMap.set(node.id, marker);
    clusterGroup.addLayer(marker);
  });

  map.addLayer(clusterGroup);

  // Delegated click for .read-more buttons in popups
  const mapEl = document.getElementById('map');
  if (mapEl) {
    mapEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.read-more');
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
  <button
    id="burger-btn"
    :aria-expanded="listOpen"
    :aria-label="listOpen ? 'Close node list' : 'Open node list'"
    @click="listOpen ? closeList() : openList()"
  >
    ☰
  </button>
  <NodePanel :node="selectedNode" @close="closePanel" />
  <NodeList :nodes="nodes" :open="listOpen" @close="closeList" @select="onNodeSelect" />
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
