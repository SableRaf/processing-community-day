# PRD: PCD Website v2.1

## Context

Processing Community Day 2026 marks the 25th anniversary of Processing. Events take place across October 2026 as a globally distributed set of independently organized local events, called nodes.

This v2 is a clean rebuild of the proof-of-concept at `pcd-website-mvp/`. It lives in a new, empty sibling folder. The data pipeline (Google Form → Sheets → CSV → `nodes.json`) is unchanged and out of scope here — this PRD covers the website only.

---

## What We're Building

A static website that:

1. Displays all confirmed PCD 2026 nodes on a world map
2. Lets visitors click a node to see full event details
3. Offers a flat alphabetical list of all nodes via a burger menu
4. Requires no API keys, no backend, no database
5. Is fully keyboard-accessible

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | [Astro](https://astro.build) (static output) |
| UI components | [Vue 3](https://vuejs.org) via `@astrojs/vue` |
| Map | [Leaflet](https://leafletjs.com) + OpenStreetMap tiles |
| Marker clustering | `leaflet.markercluster` |
| Map tiles | [CartoDB Positron (no labels)](https://basemaps.cartocdn.com) + [Stamen Toner Labels](https://tiles.stadiamaps.com) |
| Plus code decoding | `open-location-code` npm package |
| Focus trapping | `focus-trap` npm package |
| Fonts | IBM Plex Sans (same as MVP) |
| Deployment | Netlify |

No state management library. No router. No backend.

---

## Repository Setup

### Prerequisites

- Node.js 20+
- npm

### Create the project

```bash
npm create astro@latest pcd-website
cd pcd-website
npx astro add vue
npm install leaflet leaflet.markercluster open-location-code focus-trap
npm install --save-dev @types/leaflet
```

### Copy data from the MVP

```bash
cp ../pcd-website-mvp/data/nodes.json src/data/nodes.json
```

`nodes.json` is the only runtime data dependency. Update the two nodes that currently use short plus codes before running the build (see Data section below).

> **Note:** `nodes.schema.json` lives in `pcd-website-mvp/` alongside the validation scripts. It is not copied into this project — nothing in the build or runtime uses it.

---

## File Structure

```
pcd-website/
  src/
    pages/
      index.astro           # Page shell: loads nodes at build time, passes to MapView
    components/
      MapView.vue           # Leaflet map, custom SVG markers, clustering
      NodePanel.vue          # Slide-in detail panel: full description + all links
      NodeList.vue           # Burger menu overlay: flat alphabetical list of nodes
    lib/
      nodes.ts              # loadNodes(): reads nodes.json, decodes plus codes → {lat, lng}
      format.ts             # formatDate(), calendarLinks() — pure functions, no DOM
      popup.ts              # makePopupContent(), escapeHtml() — popup HTML builder
    styles/
      global.css            # Design tokens, resets, IBM Plex Sans import, popup styles
    data/
      nodes.json            # Copied from pcd-website-mvp/data/nodes.json
  public/                   # Static assets (favicon, etc.)
  astro.config.mjs
  tsconfig.json
  netlify.toml
  package.json
```

---

## Data

### nodes.json

Structure is unchanged from the MVP:

```json
{
  "nodes": [
    {
      "id": "berlin-2026",
      "name": "PCD @ Berlin",
      "city": "Berlin",
      "country": "Germany",
      "venue": "Prachtsaal",
      "address": "Jonasstraße 22, 12053 Berlin",
      "date": "2026-10-17",
      "plus_code": "9F4MGCFM+PF",
      "website": "https://creativecode.berlin",
      "description": "...",
      "long_description": "...",
      "organizer_email": "organizer@example.org"
    }
  ]
}
```

### Plus code requirement

**All plus codes must be full global codes (8+ digits before the `+`)** — no short/compound codes with a city suffix.

- Full code (valid): `9F4MGCFM+PF`
- Short code (invalid): `FCCM+PF Berlin`

Full codes can be decoded offline by `open-location-code`. Short codes require a geocoding API call to resolve the city reference, which we're eliminating.

**Before first build:** update these two entries in `nodes.json`:
- `berlin-2026`: `"FCCM+PF Berlin"` → look up and replace with full code
- Check remaining entries — any code containing a space is a short code

Full plus codes are available from [plus.codes](https://plus.codes) or Google Maps (right-click → "What's here?").

### Typed node interface

Define this in `src/lib/nodes.ts` and use it throughout:

```ts
export interface Node {
  id: string;
  name: string;
  city: string;
  country: string;
  venue: string;
  address?: string;
  date: string;           // YYYY-MM-DD
  plus_code: string;
  lat: number;            // decoded from plus_code at build time
  lng: number;            // decoded from plus_code at build time
  website: string;
  description: string;
  long_description?: string;
  organizer_email: string;
}
```

---

## Components

### `src/lib/nodes.ts`

Reads `nodes.json` at Astro build time, decodes each `plus_code` to `{lat, lng}` using `open-location-code`, returns a typed `Node[]`.

**The build must fail if any node has an invalid plus code.** With only ~10–40 nodes, a silent skip would hide data errors until someone notices a missing marker in production. Throw an error instead of silently dropping the node.

```ts
import { readFileSync } from 'fs';
import { resolve } from 'path';
import OpenLocationCode from 'open-location-code';

export function loadNodes(): Node[] {
  const raw = readFileSync(resolve('src/data/nodes.json'), 'utf-8');
  const { nodes } = JSON.parse(raw);
  return nodes.map((node: any) => {
    if (!OpenLocationCode.isValid(node.plus_code) || !OpenLocationCode.isFull(node.plus_code)) {
      throw new Error(
        `[nodes] Invalid or short plus_code for "${node.id}": "${node.plus_code}". ` +
        `All plus codes must be full global codes. Look up the full code at https://plus.codes`
      );
    }
    const decoded = OpenLocationCode.decode(node.plus_code);
    return { ...node, lat: decoded.latitudeCenter, lng: decoded.longitudeCenter };
  });
}
```

> **Import note:** The `open-location-code` npm package API varies by version. Verify whether it exports a class (requiring `new OpenLocationCode()`) or static methods. Adjust the import and calls accordingly. The key functions needed are `isValid()`, `isFull()`, and `decode()`.

### `src/lib/format.ts`

Pure utility functions. No DOM, no side effects.

#### `formatDate(dateString: string): string`

Formats `YYYY-MM-DD` to a human-readable string, e.g. `"October 17, 2026"`.

#### `calendarLinks(node: Node): { googleCalUrl: string; icsDataUri: string }`

Builds calendar links for a given node.

**Google Calendar URL format:**

```
https://www.google.com/calendar/render?action=TEMPLATE
  &text=PCD @ Berlin
  &dates=20261017/20261018       (all-day event: YYYYMMDD/next day)
  &location=Prachtsaal, Jonasstraße 22, 12053 Berlin
  &details=Join us in Berlin for a full day...
```

- `text`: `node.name`
- `dates`: `node.date` formatted as `YYYYMMDD`, end date is the next day (all-day event)
- `location`: `node.venue` + `, ` + `node.address` if present, otherwise `node.venue` + `, ` + `node.city`
- `details`: `node.description` (truncated to 500 chars if needed)
- All values must be URI-encoded

**ICS data URI format:**

```
data:text/calendar;charset=utf-8,BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PCD2026//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261017
DTEND;VALUE=DATE:20261018
SUMMARY:PCD @ Berlin
LOCATION:Prachtsaal\, Jonasstraße 22\, 12053 Berlin
DESCRIPTION:Join us in Berlin...
URL:https://creativecode.berlin
END:VEVENT
END:VCALENDAR
```

- Dates use `VALUE=DATE` (all-day, no timezone issues)
- Commas in `LOCATION` and `DESCRIPTION` must be escaped with `\,`
- Newlines in `DESCRIPTION` must be escaped as `\\n`
- The entire string after `data:text/calendar;charset=utf-8,` must be URI-encoded

### `src/lib/popup.ts`

Popup HTML builder and sanitization helpers. Extracted into its own module because the popup content lives outside Vue's component tree.

#### `escapeHtml(str: string): string`

Escapes `&`, `<`, `>`, `"`, `'` for safe HTML interpolation.

```ts
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

#### `makePopupContent(node: Node): string`

Returns an HTML string for a Leaflet popup. All user-supplied text is passed through `escapeHtml()`.

**Why an HTML string, not a Vue component:** Leaflet popups operate outside Vue's component tree — they expect an HTML string or a raw DOM element. Mounting a Vue component inside a popup is fragile with scoped styles and reactivity. The HTML template literal approach is simpler and more reliable.

```ts
export function makePopupContent(node: Node): string {
  const mapsQuery = encodeURIComponent(
    node.address || `${node.venue}, ${node.city}`
  );
  const cal = calendarLinks(node);

  return `
    <div class="node-popup">
      <h3>${escapeHtml(node.name)}</h3>
      <p class="date">${formatDate(node.date)}</p>
      <p class="venue">
        📍 <a href="https://www.google.com/maps/search/?api=1&query=${mapsQuery}"
              target="_blank" rel="noopener">
          ${escapeHtml(node.venue)}${node.address ? ', ' + escapeHtml(node.address) : ''}
        </a>
      </p>
      <p class="desc">${escapeHtml(node.description)}</p>
      <button class="read-more" data-node-id="${escapeHtml(node.id)}">Read more</button>
      <div class="popup-links">
        <a href="${escapeHtml(node.website)}" target="_blank" rel="noopener">🌐 Visit event website</a>
        <a href="${escapeHtml(cal.googleCalUrl)}" target="_blank" rel="noopener">📅 Google Calendar</a>
        · <a href="${cal.icsDataUri}" download="${escapeHtml(node.id)}.ics">📁 Download .ics</a>
        <a href="mailto:${encodeURIComponent(node.organizer_email)}">✉️ ${escapeHtml(node.organizer_email)}</a>
      </div>
    </div>`;
}
```

`MapView.vue` calls `makePopupContent()` when creating each marker's popup, and attaches event delegation on the map container for `click` events on `.read-more` buttons to open `NodePanel`.

### `src/pages/index.astro`

Calls `loadNodes()` at build time (in the frontmatter), passes result as a prop to `MapView`. Nothing else.

```astro
---
import MapView from '../components/MapView.vue';
import { loadNodes } from '../lib/nodes';
const nodes = loadNodes();
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Processing Community Day 2026</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9/dist/leaflet.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5/dist/MarkerCluster.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5/dist/MarkerCluster.Default.css" />
  </head>
  <body>
    <a href="#map" class="skip-link">Skip to map</a>
    <MapView nodes={nodes} client:only="vue" />
  </body>
</html>
```

Use `client:only="vue"` because Leaflet requires the DOM and cannot run in Astro's server-side render.

> **Leaflet CSS is required.** Without `leaflet.css` the map tiles will render incorrectly and controls will be unstyled. Without the two MarkerCluster stylesheets, cluster icons will be invisible or broken.

### `src/components/MapView.vue`

Full-viewport Leaflet map.

**Props:** `nodes: Node[]`

**Responsibilities:**
- Initialize Leaflet map with styled tile layers on `onMounted` (see Map Styling below)
- Create a custom SVG marker for each node (see Marker Design below)
- Cluster markers using `L.markerClusterGroup()`
- Fit map bounds to all markers on load
- On marker click: open a Leaflet popup using `makePopupContent()` from `popup.ts`
- Attach event delegation on the map container for `click` events on `.read-more` buttons → sets `selectedNode`
- Manage which node is selected; pass it to `NodePanel` and `NodeList`
- Render `NodePanel`, `NodeList`, and the burger menu button as overlays
- Register global keyboard shortcuts (Escape, M) via a `keydown` listener on `window`

**State:**
- `selectedNode: Node | null` — drives `NodePanel` open/closed
- `listOpen: boolean` — drives `NodeList` open/closed

**Mutual exclusivity:** `NodePanel` and `NodeList` are mutually exclusive. Opening one closes the other. This prevents layout conflicts, especially on mobile where both are full-width.

**On `NodeList` item click:** close list, fly map to that node (`map.flyTo([lat, lng], 10)`), open its popup.

> **Vue reactivity note:** `NodePanel` and `NodeList` are direct children of `MapView.vue` in the Vue component tree, so they receive props and emit events normally. The only content that lives _outside_ Vue's tree is the popup HTML, which is rendered as a string via `popup.ts`.

### `src/components/NodePanel.vue`

Slide-in panel from the right edge.

**Props:** `node: Node | null`

**Shows when `node` is not null:**
- Name (h2)
- Date + city, country
- Venue with link to Google Maps: `https://www.google.com/maps/search/?api=1&query=...`
  - If `node.address` is present, use it as the query value
  - Otherwise, fall back to `${node.venue}, ${node.city}, ${node.country}`
- `long_description` rendered as paragraphs (falls back to `description` if absent). Split on double newlines to create `<p>` elements. Do **not** use `v-html` — render each paragraph as a text node inside a `<p>` tag via `v-for`.
- Website link
- Google Calendar link + `.ics` download link (from `calendarLinks()`)
- Organizer email (`mailto:`)
- Close button (×)

**Accessibility:**
- The panel has `role="dialog"` and `aria-label="Event details"`
- Focus is trapped while open using the `focus-trap` npm package. Create a trap instance on mount, activate when `node` becomes non-null, deactivate on close.
- On open, focus moves to the close button (or the panel heading)
- On close (× button or Escape key), focus returns to the map container
- The close button is a `<button>` element (not a `<div>` or `<span>`)

**Animation:** CSS `transform: translateX(100%)` → `translateX(0)` transition.

**Responsive:** full-width on screens ≤ 720px.

### `src/components/NodeList.vue`

Burger menu overlay.

**Props:** `nodes: Node[]`, `open: boolean`

**Emits:** `close`, `select(node: Node)`

**Shows when `open` is true:**
- Full-height overlay (left side, or full-screen on mobile ≤ 720px)
- Flat alphabetical list sorted by `node.name`
- Each item: node name, city + country, date (formatted)
- Each item is a `<button>` element for keyboard accessibility
- Click → emits `select`
- Close button (×) + Escape key → emits `close`

**Accessibility:**
- The overlay has `role="dialog"` and `aria-label="Node list"`
- Focus is trapped while open using `focus-trap`
- On open, focus moves to the first list item (or the close button)
- On close, focus returns to the burger menu button
- Arrow keys navigate between list items

---

## Map Styling

The MVP uses a Google Map with a custom monochrome light style. We replicate this look with Leaflet using two layered tile sources.

### Visual target

The map should have these characteristics (matching the MVP screenshot):
- Light grey land (`#f5f5f5`)
- Medium grey water (`#c9c9c9`)
- No land cover (parks, forests) — everything reads as flat land
- No points of interest
- Roads visible only at high zoom; highways as `#dadada`, local/arterial as white
- Muted grey labels for cities, countries, and states (`#616161` text, `#f5f5f5` halo)
- Clean, minimal, monochrome — the red markers should be the most prominent visual element

### Tile layer implementation

Use **CartoDB Positron (no labels)** as the base layer, overlaid with **Stadia Stamen Toner Labels** for text. This two-layer approach closely matches the target style:

```ts
// Base: light grey land, grey water, no labels, no POIs
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19,
}).addTo(map);

// Labels: clean dark text, no icons
L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_labels/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://stadiamaps.com/">Stadia</a> &copy; <a href="https://stamen.com/">Stamen</a>',
  maxZoom: 19,
  pane: 'overlayPane',
}).addTo(map);
```

> **Note:** Stadia Maps requires a free API key for production use (free tier covers most small sites). Register at [stadiamaps.com](https://stadiamaps.com) and add the domain. Alternatively, if the label style doesn't need to be Toner, use CartoDB Positron _with_ labels as a single layer: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` — this requires no API key and is the recommended fallback.

### Map configuration

```ts
const map = L.map('map', {
  zoomControl: true,
  attributionControl: true,
  minZoom: 2,
  maxZoom: 18,
  worldCopyJump: true,          // smooth panning across the antimeridian
  keyboard: true,               // arrow keys pan, +/- zoom
  scrollWheelZoom: true,
});
```

Position the zoom control at bottom-right to avoid overlap with the burger menu:

```ts
map.zoomControl.setPosition('bottomright');
```

### Map background color

Set the map container background to match the land color so there's no flash of default grey/white before tiles load:

```css
#map {
  background-color: #f5f5f5;
}
```

---

## Marker Design

Custom SVG marker in the Processing aesthetic. Replace Leaflet's default blue pin.

The marker is a filled circle with a subtle white stroke, colored red to match the MVP. It should be the most visually prominent element on the map.

```ts
const markerIcon = L.divIcon({
  html: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" fill="#E63946" stroke="#ffffff" stroke-width="2"/>
  </svg>`,
  className: '',              // remove Leaflet's default white-box class
  iconSize: [24, 24],
  iconAnchor: [12, 12],       // center of the circle
  popupAnchor: [0, -14],      // popup appears above the marker
});
```

Define the SVG once as a constant in `MapView.vue`.

### Cluster styling

Override the default MarkerCluster styles to match the design. Clusters should use the same red fill with a white count label:

```css
/* In global.css — MarkerCluster styles are outside Vue scoped styles */
.marker-cluster-small,
.marker-cluster-medium,
.marker-cluster-large {
  background-color: rgba(230, 57, 70, 0.3);
}
.marker-cluster-small div,
.marker-cluster-medium div,
.marker-cluster-large div {
  background-color: #E63946;
  color: #ffffff;
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 600;
}
```

---

## Keyboard Accessibility

The site must be fully operable via keyboard alone.

### Map navigation

Leaflet's built-in keyboard support provides:
- **Arrow keys** pan the map
- **+/-** zoom in/out
- **Tab** moves focus to the map, then to map controls

Ensure the map container has `tabindex="0"` so it can receive focus.

### Marker navigation

Markers inside a `markerClusterGroup` are not natively keyboard-focusable. Rather than trying to make individual map markers focusable (which is fragile with clustering), use the **NodeList (burger menu) as the primary keyboard interface** for selecting nodes.

Display an on-screen hint when the map is focused: `"Press M to open the node list"` — shown as a subtle tooltip or `aria-description` on the map container.

### Global keyboard shortcuts

| Key | Action |
|---|---|
| `Escape` | Close `NodePanel` or `NodeList` (whichever is open) |
| `M` | Toggle `NodeList` open/closed (only when no text input is focused) |

Register these on the `MapView` component via a `keydown` listener on `window`. Only respond when the active element is not an `<input>`, `<textarea>`, or `<select>`.

### Focus management

- **Skip link:** A visually-hidden `<a href="#map" class="skip-link">Skip to map</a>` at the top of the page, visible on focus. Styled with `position: absolute; top: -100%; ...` and `:focus { top: 0.5rem; ... }`.
- **Burger menu button:** Always visible and focusable. Has `aria-label="Open node list"` (or `"Close node list"` when open). Has `aria-expanded` matching `listOpen`.
- **NodePanel:** See NodePanel accessibility section above.
- **NodeList:** See NodeList accessibility section above.

---

## Styling

### Design tokens (carry over from MVP)

```css
:root {
  --bg: #f6f1e8;
  --ink: #1f1f1f;
  --border: #d9cfbf;
  --marker-red: #E63946;
}
```

### Font

IBM Plex Sans — load from Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
```

### Layout

- Map is full viewport (`width: 100vw; height: 100vh`)
- `NodePanel` and `NodeList` are `position: fixed` overlays
- Burger button: `position: fixed; top: 1rem; left: 1rem; z-index: 1000`
- Zoom control: bottom-right (configured via Leaflet, see Map Configuration)

### Loading state

Display a centered loading indicator (CSS spinner or "Loading map…" text) inside the `#map` container. The indicator is visible while tiles are loading and is removed on the map's first `tileload` event. Use the `#f5f5f5` background color on the container so the transition to loaded tiles is seamless.

### Popup styles

Because Leaflet popups render outside Vue's scoped style boundary, define `.node-popup` styles in `global.css`:

```css
.node-popup h3 {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
  color: var(--ink);
}
.node-popup .date {
  color: #616161;
  font-size: 0.9rem;
  margin: 0 0 0.5rem;
}
.node-popup .read-more {
  display: inline-block;
  margin-top: 0.5rem;
  background: none;
  border: none;
  color: var(--ink);
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  font-family: 'IBM Plex Sans', sans-serif;
}
.node-popup .popup-links {
  margin-top: 0.75rem;
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.node-popup .popup-links a {
  color: var(--ink);
  text-decoration: underline;
}
```

### Scoped styles

Use `<style scoped>` in each Vue component. Only global resets, design tokens, popup styles, and cluster overrides go in `global.css`.

---

## Netlify Configuration

`netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

No environment variables required. No API keys in the codebase or Netlify config.

> **Note:** The previous draft had a cache header for `/data/*`, but since `nodes.json` is inlined at build time (not copied to `dist/`), that header would never match anything. Removed.

---

## Security

All user-supplied text from `nodes.json` that is rendered into the DOM must be escaped.

- **In Vue templates:** automatic — Vue escapes interpolations by default. Do not use `v-html`.
- **In Leaflet popup HTML strings:** use the `escapeHtml()` helper from `popup.ts`. Every interpolation of node data into the popup template literal must be escaped.

---

## What's Out of Scope

- Node registration form (handled by the existing Google Form → CSV pipeline)
- Search or filter on the node list
- i18n
- Dark mode
- Unit tests
- The `build-nodes.js` and `validate-nodes.js` scripts (unchanged, stay in `pcd-website-mvp`)
- `nodes.schema.json` (stays in `pcd-website-mvp`, used only by validation scripts)

---

## Definition of Done

- [ ] `npm run build` succeeds with zero errors and zero warnings
- [ ] Build fails with a clear error if any node has an invalid or short plus code
- [ ] Map loads with monochrome light styling matching the MVP look (light grey land, grey water, no POIs)
- [ ] Map displays all nodes from `nodes.json` with red circle SVG markers
- [ ] Markers cluster at low zoom levels with styled cluster icons
- [ ] Marker click opens a popup with name, date, venue, description, links, and "Read more"
- [ ] "Read more" opens `NodePanel` with full details, working calendar links, and map link
- [ ] Google Maps link falls back gracefully when `address` is missing
- [ ] Burger menu opens `NodeList`; clicking a node flies the map to it and opens its popup
- [ ] Escape key closes `NodePanel` and `NodeList`
- [ ] `M` key toggles `NodeList`
- [ ] `NodePanel` and `NodeList` are mutually exclusive (opening one closes the other)
- [ ] `NodePanel` and `NodeList` trap focus while open and return focus on close
- [ ] All interactive elements are reachable and operable via keyboard
- [ ] Skip link is present and functional
- [ ] Page is usable on mobile (≤ 720px): NodePanel is full-width, NodeList is full-screen
- [ ] No API keys anywhere in the codebase or Netlify environment
- [ ] Deploys successfully on Netlify

---

## Changelog (v2.0 → v2.1)

1. **`open-location-code` import:** Added note that the package API varies by version; implementer must verify whether it exports a class or static methods.
2. **Build fails on bad plus codes:** `loadNodes()` now throws instead of silently skipping nodes with invalid plus codes.
3. **Berlin plus code example fixed:** Data example now shows a placeholder full code; the "before first build" instruction no longer contradicts the example.
4. **Leaflet CSS imports added:** `index.astro` now explicitly loads `leaflet.css`, `MarkerCluster.css`, and `MarkerCluster.Default.css`.
5. **NodeCard rendering strategy decided:** HTML template literal via `popup.ts` (not Vue `h()`/`render()`), with `escapeHtml()` for all interpolated node data.
6. **NodeCard.vue removed from file structure:** Popup content is built as an HTML string in `src/lib/popup.ts`, not as a Vue component. The file tree and component list updated accordingly.
7. **Focus trapping specified:** `focus-trap` npm package added to dependencies; activation/deactivation lifecycle described for both `NodePanel` and `NodeList`.
8. **Map styling specified:** Two-layer tile approach (CartoDB Positron no-labels + Stadia Toner Labels) to replicate the MVP's monochrome Google Maps style. Map configuration and background color specified.
9. **Marker and cluster styling specified:** Red circle SVG marker with exact color. Cluster icon style overrides in `global.css`.
10. **Keyboard accessibility added:** Global shortcuts (Escape, M), skip link, `aria-*` attributes, focus return behavior, and the recommended approach for keyboard node selection via NodeList.
11. **Mutual exclusivity rule:** NodePanel and NodeList cannot be open simultaneously.
12. **`address` fallback specified:** Google Maps link falls back to `venue, city, country` when `address` is missing.
13. **`calendarLinks()` format specified:** Full URL format for Google Calendar and ICS data URI, including escaping rules.
14. **Loading state added:** CSS spinner or text shown while tiles load.
15. **Schema file dropped:** `nodes.schema.json` is no longer copied into the project.
16. **Dead Netlify cache header removed:** `/data/*` header removed since nodes are inlined at build time.
17. **Popup styles in global.css:** Explicit guidance that popup CSS must be global since Leaflet popups are outside Vue's scoped style boundary.