# Work Packages — PCD Website v2.1

---

## WP-00 · Project Scaffolding & Data Setup

**Goal:** Runnable Astro + Vue project with valid data.

**Inputs:**
- `pcd-website-mvp/data/nodes.json`

**Tasks:**
1. Run `npm create astro@latest`, add Vue integration
2. Install dependencies: `leaflet`, `leaflet.markercluster`, `open-location-code`, `focus-trap`, `@types/leaflet`
3. Copy `nodes.json` → `src/data/nodes.json`
4. Fix invalid plus codes (any containing a space), starting with `berlin-2026`
5. Add `netlify.toml`
6. Verify `npm run build` succeeds (no content yet — just the scaffold)

**Outputs:** Boilerplate project builds cleanly; `nodes.json` has only full global plus codes.

**Done when:** `npm run build` exits 0; no short plus codes remain in `nodes.json`.

---

## WP-01 · Data Layer (`src/lib/nodes.ts` + `src/lib/format.ts`)

**Goal:** Typed, validated node loading and pure formatting utilities.

**Inputs:** `src/data/nodes.json`

**Tasks:**
1. Define `Node` interface in `nodes.ts`
2. Implement `loadNodes()` — decode plus codes, throw on invalid/short code
3. Implement `formatDate()` in `format.ts`
4. Implement `calendarLinks()` in `format.ts` — Google Calendar URL + ICS data URI, per spec escaping rules

**Outputs:** `loadNodes()` returns `Node[]`; build fails with a clear message on bad plus codes.

**Done when:** `loadNodes()` works for all current nodes; intentionally breaking a plus code produces a clear build error.

---

## WP-02 · Popup Builder (`src/lib/popup.ts`)

**Goal:** Safe HTML string builder for Leaflet popups.

**Inputs:** `Node` interface, `format.ts` utilities

**Tasks:**
1. Implement `escapeHtml()` — escape `& < > " '`
2. Implement `makePopupContent()` — all node fields interpolated through `escapeHtml()`; "Read more" button with `data-node-id`

**Outputs:** `makePopupContent(node)` returns a sanitised HTML string.

**Done when:** XSS characters in node fields are escaped; "Read more" button carries the correct `data-node-id`.

---

## WP-03 · Map Component (`src/components/MapView.vue`)

**Goal:** Full-viewport Leaflet map with markers, clustering, popups, and overlay management.

**Inputs:** `Node[]` prop, `popup.ts`, `NodePanel.vue`, `NodeList.vue`

**Tasks:**
1. Initialize Leaflet map with CartoDB Positron (no-labels) + Stadia Toner Labels tile layers
2. Configure map options (`minZoom: 2`, `worldCopyJump`, zoom control at `bottomright`)
3. Create red circle SVG `divIcon`; apply to each node
4. Add markers to `L.markerClusterGroup()`; fit bounds on load
5. On marker click: open popup via `makePopupContent()`
6. Event delegation on map container for `.read-more` click → set `selectedNode`
7. Manage `selectedNode` and `listOpen` state; enforce mutual exclusivity
8. Render `NodePanel` and `NodeList` as overlays; wire props/events
9. Burger menu button (fixed top-left, `aria-expanded`, `aria-label`)
10. Global `keydown` on `window`: Escape closes panel/list; M toggles list (guard against input focus)
11. Loading indicator — remove on first `tileload`

**Outputs:** Interactive map with all nodes; panels open/close correctly; keyboard shortcuts work.

**Done when:** All Definition of Done items relating to map, markers, clustering, popup, and keyboard shortcuts pass.

---

## WP-04 · Node Detail Panel (`src/components/NodePanel.vue`)

**Goal:** Accessible slide-in detail panel.

**Inputs:** `Node | null` prop, `format.ts` utilities

**Tasks:**
1. Render all fields: name, date + location, venue (Maps link with `address` fallback), `long_description` / `description` as `<p>` via `v-for` (no `v-html`), website, calendar links, email
2. CSS slide-in animation (`translateX` transition)
3. Full-width on ≤ 720px
4. `role="dialog"`, `aria-label="Event details"`, close button as `<button>`
5. `focus-trap` integration: activate on open, deactivate on close; focus to close button on open; return focus to map container on close

**Outputs:** Panel slides in/out; all node data renders correctly; focus is trapped and returned.

**Done when:** Panel DoD items pass; no `v-html` used; focus trap activates/deactivates correctly.

---

## WP-05 · Node List Overlay (`src/components/NodeList.vue`)

**Goal:** Accessible burger-menu overlay with alphabetical node list.

**Inputs:** `nodes: Node[]`, `open: boolean` props; `format.ts` for date display

**Tasks:**
1. Render sorted list (`node.name` alphabetical); each item a `<button>` with name, city + country, formatted date
2. Emit `select(node)` on item click; emit `close` on × button / Escape
3. Full-screen on ≤ 720px
4. `role="dialog"`, `aria-label="Node list"`
5. `focus-trap` integration: focus to first item on open; return focus to burger button on close
6. Arrow key navigation between list items

**Outputs:** Overlay opens/closes; clicking an item triggers map fly-to + popup in `MapView`.

**Done when:** List DoD items pass; arrow keys navigate items; focus is trapped and returned.

---

## WP-06 · Styles & Page Shell

**Goal:** Design tokens, global CSS, popup/cluster overrides, `index.astro`.

**Inputs:** All components

**Tasks:**
1. `global.css` — design tokens (`--bg`, `--ink`, `--border`, `--marker-red`), resets, IBM Plex Sans import, `.node-popup` styles, `.marker-cluster-*` overrides, map background `#f5f5f5`, skip-link styles
2. `index.astro` — calls `loadNodes()`, passes to `<MapView client:only="vue" />`, loads Leaflet + MarkerCluster CSS from CDN, skip link, font `<link>` tags, viewport meta

**Outputs:** Styled page shell; popup and cluster icons render correctly; skip link is functional.

**Done when:** Visual output matches MVP screenshot; skip link visible on focus; no unstyled Leaflet controls.

---

## WP-07 · Netlify Deployment & Smoke Test

**Goal:** Live deployment on Netlify; final DoD verification.

**Inputs:** All WPs complete; Netlify site created

**Tasks:**
1. Connect repo to Netlify; set build command `npm run build`, publish dir `dist`
2. Confirm no API keys in codebase or Netlify environment variables
3. Run through entire Definition of Done checklist on the deployed URL
4. Verify Stadia Maps tile domain is registered (or fall back to CartoDB with-labels single layer)

**Outputs:** Public URL; all 18 DoD checkboxes ticked.

**Done when:** Full DoD passes on production URL.

---

## Dependency Order

```
WP-00 → WP-01 → WP-02 ─┐
                         ├─→ WP-03 ─┐
              WP-04 ─────┘           ├─→ WP-06 → WP-07
              WP-05 ─────────────────┘
```

WP-01 and WP-02 can be built in parallel once WP-00 is done. WP-04 and WP-05 can be built in parallel and don't depend on WP-02. WP-03 integrates everything and should come last among the component work.
