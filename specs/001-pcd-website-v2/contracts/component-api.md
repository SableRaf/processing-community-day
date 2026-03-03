# Contract: Vue Component API

**Branch**: `001-pcd-website-v2` | **Date**: 2026-03-03

---

## Overview

This document defines the public interface (props and emits) for each Vue 3 component in the PCD website. Components communicate exclusively via props-down / events-up. No shared state store or event bus.

---

## `MapView.vue`

**Location**: `src/components/MapView.vue`
**Usage**: `<MapView :nodes="nodes" client:only="vue" />` (in `index.astro`)

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `nodes` | `Node[]` | ✅ | Array of all nodes, with `lat`/`lng` decoded. Passed from `loadNodes()` at build time. |

### Internal State

| State | Type | Description |
|-------|------|-------------|
| `selectedNode` | `Node \| null` | The node currently shown in NodePanel. `null` = panel closed. |
| `listOpen` | `boolean` | Whether the NodeList overlay is open. |

### Emits

None — MapView is the root component; it manages all UI state internally.

### Responsibilities

- Initialize Leaflet map with tile layers on `onMounted`
- Create custom SVG markers for each node
- Cluster markers via `L.markerClusterGroup()`
- Open Leaflet popups on marker click (using `makePopupContent()`)
- Delegate `click` events on `.read-more` buttons → set `selectedNode`
- Delegate `click` events on `.node-fly` buttons (node list items) → fly map + open popup
- Register global keyboard shortcuts: `Escape` (close panel/list), `M` (toggle list)
- Render `NodePanel` and `NodeList` as overlays
- Render burger menu button with correct `aria-expanded` and `aria-label`

### Mutual Exclusivity Rule

Setting `selectedNode` to a non-null value MUST set `listOpen` to `false`.
Setting `listOpen` to `true` MUST set `selectedNode` to `null`.

---

## `NodePanel.vue`

**Location**: `src/components/NodePanel.vue`
**Usage**: `<NodePanel :node="selectedNode" @close="selectedNode = null" />` (inside MapView.vue)

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `node` | `Node \| null` | ✅ | The node to display. `null` = panel hidden/closed. |

### Emits

| Event | Payload | Description |
|-------|---------|-------------|
| `close` | — | Emitted when the user closes the panel (× button, Escape key, or focus-trap deactivation). Parent sets `selectedNode = null`. |

### Behavior

- **Visible when**: `node !== null`
- **Hidden when**: `node === null`
- **On show**: Slide in from right (`translateX(100%)` → `translateX(0)`). Activate focus trap; move focus to close button.
- **On hide**: Slide out. Deactivate focus trap. Return focus to `#map` container.
- **Focus trap**: Uses `focus-trap` package. Traps Tab/Shift-Tab within the panel while open.
- **Escape key**: Handled by focus-trap `escapeDeactivates: true` → triggers `onDeactivate` → emits `close`.

### Accessibility Attributes (on panel container)

```html
<aside
  role="dialog"
  aria-modal="true"
  aria-labelledby="panel-title"
  tabindex="-1"
>
  <h2 id="panel-title">{{ node.name }}</h2>
  ...
  <button @click="emit('close')" aria-label="Close event details">×</button>
</aside>
```

### Responsive

- Width: `clamp(320px, 40vw, 520px)` on screens > 720px
- Width: `100vw` on screens ≤ 720px (`@media (max-width: 720px)`)

---

## `NodeList.vue`

**Location**: `src/components/NodeList.vue`
**Usage**: `<NodeList :nodes="nodes" :open="listOpen" @close="listOpen = false" @select="onNodeSelect" />` (inside MapView.vue)

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `nodes` | `Node[]` | ✅ | All nodes. Sorted alphabetically by `name` inside the component. |
| `open` | `boolean` | ✅ | Whether the overlay is visible. |

### Emits

| Event | Payload | Description |
|-------|---------|-------------|
| `close` | — | Emitted when the user closes the overlay (× button, Escape key, or focus-trap deactivation). |
| `select` | `Node` | Emitted when the user clicks a node entry. Parent closes list, flies map, opens popup. |

### Behavior

- **Visible when**: `open === true`
- **Hidden when**: `open === false`
- **On show**: Activate focus trap. Move focus to first list item button.
- **On hide**: Deactivate focus trap. Return focus to burger menu button.
- **Sorting**: Nodes sorted alphabetically by `name` (`localeCompare`).
- **Arrow key navigation**: `ArrowDown` / `ArrowUp` move focus between `.node-item` buttons.
- **Focus trap**: Tab/Shift-Tab cycle only within the overlay while open.
- **Escape key**: Handled by focus-trap → emits `close`.

### List Item Structure

Each node entry is a `<button>` element (not `<a>`, not `<div>`):
```html
<button class="node-item" @click="emit('select', node)">
  <span class="node-name">{{ node.name }}</span>
  <span class="node-location">{{ node.city }}, {{ node.country }}</span>
  <span class="node-date">{{ formatDate(node.date) }}</span>
</button>
```

### Accessibility Attributes (on overlay container)

```html
<div
  role="dialog"
  aria-modal="true"
  aria-label="Node list"
  tabindex="-1"
>
  <button @click="emit('close')" aria-label="Close node list">×</button>
  <ul>
    <li v-for="node in sortedNodes" :key="node.id">
      <button class="node-item" @click="emit('select', node)">...</button>
    </li>
  </ul>
</div>
```

### Responsive

- Width / position: left panel on screens > 720px
- Full-screen on screens ≤ 720px (`@media (max-width: 720px)`)

---

## Burger Menu Button

**Location**: Inside `MapView.vue` template (not a separate component)
**Position**: `fixed; top: 1rem; left: 1rem; z-index: 1000`

### Attributes

```html
<button
  id="burger-btn"
  :aria-expanded="listOpen"
  :aria-label="listOpen ? 'Close node list' : 'Open node list'"
  @click="listOpen = !listOpen"
>
  ☰
</button>
```

- `aria-expanded` MUST reflect the current `listOpen` state.
- Focus returns to `#burger-btn` when `NodeList` closes.

---

## `src/lib/format.ts` — Function Contracts

### `formatDate(dateString: string): string`

- **Input**: ISO date string `"YYYY-MM-DD"`
- **Output**: Human-readable string, e.g. `"October 17, 2026"`
- **Side effects**: None
- **Error handling**: Returns the input string unchanged if parsing fails

### `calendarLinks(node: Node): { googleCalUrl: string; icsContent: string }`

- **Input**: `Node` object
- **Output**:
  - `googleCalUrl`: Pre-filled Google Calendar event creation URL (all values URL-encoded)
  - `icsContent`: Valid iCalendar string (to be wrapped in Blob or data URI by caller)
- **Side effects**: None
- **All-day event convention**: DTEND is the day after DTSTART (exclusive per RFC 5545)

---

## `src/lib/popup.ts` — Function Contracts

### `escapeHtml(str: string): string`

- **Input**: Arbitrary string
- **Output**: String with `&`, `<`, `>`, `"`, `'` replaced by HTML entities
- **Side effects**: None
- **Used for**: All user-supplied text interpolated into Leaflet popup HTML strings

### `makePopupContent(node: Node): string`

- **Input**: `Node` object
- **Output**: HTML string for a Leaflet popup
- **Side effects**: None
- **Security**: All node string fields passed through `escapeHtml()` before interpolation
- **Structure**: Includes node name, date, venue with maps link, description, "Read more" button (`data-node-id` attribute), website link, Google Calendar link, ICS data URI download link, organizer email

---

## `src/lib/nodes.ts` — Function Contracts

### `loadNodes(): Node[]`

- **Input**: None (reads `src/data/nodes.json` from filesystem)
- **Output**: `Node[]` with `lat` and `lng` fields added
- **Side effects**: Reads filesystem; throws on invalid plus code
- **Error**: Throws `Error` with descriptive message if any node's `plus_code` is invalid or short
- **Called by**: `src/pages/index.astro` frontmatter (Astro build time only)
