# Tasks: PCD Website v2.1

**Input**: Design documents from `/specs/001-pcd-website-v2/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: No automated tests (explicitly out of scope per spec.md — "Automated unit tests" is listed under Out of Scope). Manual accessibility verification only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in descriptions

## Path Conventions

All source paths are relative to `pcd-website/` (the Astro project subdirectory per quickstart.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the Astro project and install all dependencies before any feature work begins.

- [ ] T001 Scaffold Astro project in `pcd-website/` using minimal template: `npm create astro@latest pcd-website -- --template minimal --no-install --no-git`
- [ ] T002 Add Vue 3 integration: `cd pcd-website && npx astro add vue --yes`
- [ ] T003 Install runtime dependencies: `npm install leaflet leaflet.markercluster open-location-code focus-trap`
- [ ] T004 [P] Install dev dependencies: `npm install --save-dev @types/leaflet @types/leaflet.markercluster`
- [ ] T005 Configure `pcd-website/astro.config.mjs`: set `output: 'static'`, add Vue integration, set `site`/`base` for GitHub Pages, add Vite `rollupOptions` to suppress leaflet.markercluster circular dependency warning
- [ ] T006 Configure `pcd-website/tsconfig.json` to extend `astro/tsconfigs/strict` with `include` and `exclude` fields
- [ ] T007 Create directory structure: `src/pages/`, `src/components/`, `src/lib/`, `src/styles/`, `src/data/` inside `pcd-website/`
- [ ] T008 Copy node data file to `pcd-website/src/data/nodes.json` (from upstream pipeline or create sample with 2+ nodes matching the contract in `contracts/node-schema.md`)
- [ ] T009 Create `.github/workflows/deploy.yml` at repository root with the GitHub Actions workflow from `research.md` R-005 (build in `pcd-website/` subdirectory, upload `pcd-website/dist/`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core lib modules and global styles that ALL user stories depend on. Must be complete before any Vue component or page work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T010 Implement `pcd-website/src/lib/nodes.ts`: export `Node` interface (id, name, city, country, venue, address?, plus_code, lat, lng, date, website, description, long_description?, organizer_email) and `loadNodes()` function that reads `src/data/nodes.json`, calls `OpenLocationCode.isValid()` + `OpenLocationCode.isFull()` for each plus_code, throws descriptive error on invalid/short code per `contracts/node-schema.md` V-001, and returns `Node[]` with decoded `lat`/`lng` from `OpenLocationCode.decode().latitudeCenter/.longitudeCenter`
- [ ] T011 [P] Implement `pcd-website/src/lib/format.ts`: export `formatDate(dateString: string): string` (ISO date → "October 17, 2026" format) and `calendarLinks(node: Node): { googleCalUrl: string; icsContent: string }` per `contracts/component-api.md` — Google Calendar URL with URL-encoded `text`/`dates`/`location`/`details` params; ICS content with VCALENDAR/VEVENT structure, all-day DTSTART/DTEND (exclusive), UID as `{node.id}-{node.date}@pcd2026`, comma/newline escaping per `data-model.md`
- [ ] T012 [P] Implement `pcd-website/src/lib/popup.ts`: export `escapeHtml(str: string): string` (replaces `&`, `<`, `>`, `"`, `'` with HTML entities) and `makePopupContent(node: Node): string` that builds full Leaflet popup HTML — node name, formatted date, venue with maps link (address fallback to `venue, city, country`), description, "Read more" button with `data-node-id`, website link, Google Calendar link, ICS data URI download link, organizer email — all string fields passed through `escapeHtml()` per `contracts/component-api.md`
- [ ] T013 Create `pcd-website/src/styles/global.css`: IBM Plex Sans Google Fonts import (`@import` from fonts.googleapis.com), CSS custom properties for design tokens (colors, spacing, z-index), CSS reset, Leaflet popup styles (`.leaflet-popup-content-wrapper`, `.leaflet-popup button.read-more`), cluster icon overrides (`.marker-cluster` red fill, white label), skip link styles (`.skip-link` — visually hidden until focused), focus indicator styles (`outline: 2px solid` on `:focus-visible`), burger button styles (`#burger-btn` fixed top-left)

**Checkpoint**: Foundation ready — `loadNodes()`, `formatDate()`, `calendarLinks()`, `makePopupContent()`, `escapeHtml()` all implemented. Global styles in place. User story implementation can now begin.

---

## Phase 3: User Story 1 — Discover nodes on the map (Priority: P1) 🎯 MVP

**Goal**: A visitor lands on the site, sees a world map with red circle markers at all PCD 2026 node locations, can pan/zoom, and sees markers cluster at low zoom.

**Independent Test**: Open the site in a browser. Verify all nodes from `nodes.json` appear as red markers at correct positions. Zoom out to verify clustering with counts. Zoom in to verify clusters expand. Build with an invalid plus_code and verify the build fails with a descriptive error.

### Implementation for User Story 1

- [ ] T014 [US1] Implement `pcd-website/src/components/MapView.vue` — scaffold: `<script setup lang="ts">` with `nodes: Node[]` prop, `selectedNode: Node | null` and `listOpen: boolean` internal state; `<template>` with map container `<div id="map">`, burger button (`#burger-btn` with `:aria-expanded`, `:aria-label`), `<NodePanel>` and `<NodeList>` child components; `<style scoped>` with map container taking full viewport
- [ ] T015 [US1] Add Leaflet map initialization to `MapView.vue` `onMounted`: initialize `L.map('#map')` with CartoDB light-no-labels tile layer (monochrome, no POI), set default view to world bounds; add `L.markerClusterGroup()` cluster layer; create custom red SVG `L.divIcon` for each node; add markers to cluster group; add cluster group to map; show/hide loading indicator while tiles load (listen to `load` event on tile layer); handle mutual exclusivity: `selectedNode = non-null → listOpen = false`, `listOpen = true → selectedNode = null`
- [ ] T016 [US1] Add popup handling to `MapView.vue`: on marker click, call `makePopupContent(node)` and bind to marker popup; add delegated click listener on map container for `.read-more` buttons (read `data-node-id`, find node, set `selectedNode`); add delegated click listener for `.node-fly` class (used by NodeList select); register `keydown` on `document` for `Escape` (close panel or list) and `M` (toggle list when `#map` is focused and no text input active)
- [ ] T017 [US1] Create `pcd-website/src/pages/index.astro`: import `loadNodes()` in frontmatter; add `<head>` with title "Processing Community Day 2026", meta description, `<link>` tags for `leaflet/dist/leaflet.css`, `leaflet.markercluster/dist/MarkerCluster.css`, `leaflet.markercluster/dist/MarkerCluster.Default.css`, IBM Plex Sans; import `global.css`; add `<a href="#map" class="skip-link">Skip to map</a>`; render `<MapView :nodes={nodes} client:only="vue" />`

**Checkpoint**: US1 complete. `npm run dev` shows world map with red markers and clustering. `npm run build` fails on bad plus_code. All map interactions (pan, zoom, cluster expand) work.

---

## Phase 4: User Story 2 — Read full event details (Priority: P2)

**Goal**: Clicking a marker opens a popup with node name, date, venue, short description, and links. Clicking "Read more" opens a slide-in detail panel with full details, all links, and calendar download.

**Independent Test**: Click any marker. Verify popup content (name, formatted date, venue, description, links). Click "Read more". Verify NodePanel slides in with full details, Google Calendar link opens correctly, ICS file downloads. Click × to close. Verify focus returns to map.

### Implementation for User Story 2

- [ ] T018 [US2] Implement `pcd-website/src/components/NodePanel.vue`: `<script setup lang="ts">` with `node: Node | null` prop and `close` emit; `<template>` with `<aside role="dialog" aria-modal="true" aria-labelledby="panel-title" tabindex="-1">` — close button (`aria-label="Close event details"`), `<h2 id="panel-title">` with node name, formatted date + city/country, venue with Google Maps link (address or `venue, city, country` fallback per FR-009), full description as `<p>` paragraphs (split on `\n\n`), website link, Google Calendar link (from `calendarLinks()`), ICS download (Blob URL pattern from `research.md` R-007), organizer email as `mailto:` link; slide-in/out `translateX` CSS transition triggered by `node !== null`
- [ ] T019 [US2] Add `focus-trap` integration to `NodePanel.vue`: import `createFocusTrap` in `onMounted`, create trap on panel ref with `initialFocus` targeting close button, `escapeDeactivates: true`, `onDeactivate` emitting `close`, `returnFocusOnDeactivate: false`; `watch(() => props.node)` — activate trap when node is set, deactivate and `document.getElementById('map')?.focus()` when node becomes null (per `research.md` R-004)
- [ ] T020 [US2] Add responsive styles to `NodePanel.vue` `<style scoped>`: panel positioned `fixed; right: 0; top: 0; height: 100%`; width `clamp(320px, 40vw, 520px)` default; `@media (max-width: 720px) { width: 100vw }` per `contracts/component-api.md`; slide transition with CSS `transform: translateX(100%)` when hidden, `translateX(0)` when shown; z-index above map; scrollable content

**Checkpoint**: US2 complete. Full popup → panel → calendar flow works. Panel closes on Escape and × with focus returning to map.

---

## Phase 5: User Story 3 — Browse all nodes alphabetically (Priority: P3)

**Goal**: Clicking the burger menu opens a full alphabetical list overlay showing all nodes. Clicking an entry closes the list, flies the map to that node, and opens its popup.

**Independent Test**: Click the burger menu. Verify all nodes appear sorted alphabetically with name, city/country, and formatted date. Click any node entry. Verify the list closes, map flies to the node, and its popup opens. Click × to close list. Press Escape to close list.

### Implementation for User Story 3

- [ ] T021 [US3] Implement `pcd-website/src/components/NodeList.vue`: `<script setup lang="ts">` with `nodes: Node[]` and `open: boolean` props, `close` and `select: Node` emits; `<template>` with `<div role="dialog" aria-modal="true" aria-label="Node list" tabindex="-1" v-show="open">` — close button (`aria-label="Close node list"`), `<ul>` with `<li>` per node sorted by `name.localeCompare()`; each entry is `<button class="node-item" @click="emit('select', node)">` showing `node.name`, `{{ node.city }}, {{ node.country }}`, `formatDate(node.date)` per `contracts/component-api.md`
- [ ] T022 [US3] Add arrow key navigation to `NodeList.vue`: `keydown` listener on the list container — `ArrowDown` moves focus to next `.node-item` button (wrapping to first), `ArrowUp` moves focus to previous `.node-item` button (wrapping to last)
- [ ] T023 [US3] Add `focus-trap` integration to `NodeList.vue`: `createFocusTrap` in `onMounted` on list container ref, `initialFocus` targeting first `.node-item` button, `escapeDeactivates: true`, `onDeactivate` emitting `close`, `returnFocusOnDeactivate: false`; `watch(() => props.open)` — activate trap on open, deactivate and `document.getElementById('burger-btn')?.focus()` on close (per `research.md` R-004)
- [ ] T024 [US3] Add responsive styles to `NodeList.vue` `<style scoped>`: panel positioned `fixed; left: 0; top: 0; height: 100%`; width `320px` default on screens > 720px; `@media (max-width: 720px) { width: 100vw; height: 100vh }` full-screen per FR-018; z-index above map; scrollable node list

**Checkpoint**: US3 complete. Burger menu → list → node select → map fly + popup all work. List closes with Escape and × with focus returning to burger button.

---

## Phase 6: User Story 4 — Navigate entirely by keyboard (Priority: P4)

**Goal**: A keyboard-only user can complete the full discovery-to-detail flow: skip link → map focus → M key → list navigation → Enter to select → Escape to close panel — without a mouse.

**Independent Test**: Disconnect mouse. Tab to activate skip link. Tab to burger button. Press M to open list. Use ArrowDown/Up to navigate items. Press Enter to select a node. Verify map flies and popup opens. Tab to "Read more" in popup. Verify panel opens with focus on close button. Tab through panel links. Press Escape to close. Verify focus returns to map.

### Implementation for User Story 4

- [ ] T025 [US4] Verify skip link is implemented in `pcd-website/src/pages/index.astro`: `<a href="#map" class="skip-link">Skip to map</a>` as first focusable element; confirm `global.css` has `.skip-link` visually hidden by default and visible on `:focus-visible` (position absolute, clip/clip-path trick) per FR-022
- [ ] T026 [US4] Verify `M` key shortcut in `MapView.vue` `keydown` handler: `M` only fires when `document.activeElement` is inside `#map` and NOT a text input (`input`, `textarea`, `[contenteditable]`); toggles `listOpen` per FR-023
- [ ] T027 [US4] Verify `Escape` key handler in `MapView.vue`: closes `NodePanel` (sets `selectedNode = null`) or `NodeList` (sets `listOpen = false`) per FR-024; note: focus-trap's `escapeDeactivates: true` handles Escape inside trapped overlays — the `MapView` handler is a fallback for when neither overlay is open
- [ ] T028 [US4] Audit all interactive elements in `MapView.vue`, `NodePanel.vue`, `NodeList.vue` for WCAG 2.2 AA compliance: verify `aria-expanded` on burger button reflects `listOpen` state (FR-032); verify `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on NodePanel and `aria-label` on NodeList containers (FR-033); verify `tabindex="-1"` on dialog containers; verify focus moves to close button on NodePanel open (FR-030) and first list item on NodeList open (FR-031); verify focus returns to `#map` on panel close (FR-028) and `#burger-btn` on list close (FR-029)
- [ ] T029 [US4] Verify focus indicator styles in `pcd-website/src/styles/global.css` meet SC 2.4.11: `:focus-visible` outline of `2px solid` on a high-contrast color (e.g. `#005fcc`) on all interactive elements — burger button, node-item buttons, close buttons, links; no `outline: none` in resets that would suppress indicators

**Checkpoint**: US4 complete. Full keyboard-only flow verified manually per quickstart.md checklist items covering skip link, M key, arrow navigation, Enter select, Escape close, focus trap, and focus return.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, visual polish, and deployment verification.

- [ ] T030 [P] Add `public/favicon.ico` or `public/favicon.svg` to `pcd-website/public/` (simple placeholder or Processing logo if available)
- [ ] T031 [P] Review `pcd-website/src/styles/global.css` for design completeness: IBM Plex Sans applied to `body`, consistent spacing/color tokens across all components, popup and cluster styles match the monochrome map aesthetic, mobile viewport meta tag in `index.astro`
- [ ] T032 Verify mutual exclusivity of NodePanel and NodeList in `MapView.vue`: opening NodePanel closes NodeList (FR-013), opening NodeList closes NodePanel (FR-019); test by opening panel then burger menu and vice versa
- [ ] T033 Verify XSS safety: open browser devtools, manually test a node with `<script>alert(1)</script>` in name/description in `nodes.json`, confirm no script executes — popup renders escaped text, Vue template auto-escapes (FR-007, SC-006)
- [ ] T034 Verify mobile viewport (≤ 720px) in browser devtools responsive mode: NodePanel is full-width (FR-011), NodeList is full-screen (FR-018), all controls reachable by touch (SC-008)
- [ ] T035 Run `npm run build` from `pcd-website/` and verify: build succeeds with zero errors; `dist/` output exists; introduce a short plus_code in `nodes.json` and verify build fails with the expected error message from `contracts/node-schema.md` V-001; revert the bad plus_code
- [ ] T036 Run `npm run preview` and walk through the quickstart.md Definition of Done checklist (18 items): map loads with monochrome tiles, all markers appear, clustering works, popup shows correct fields, NodePanel slides in from right, calendar links work, NodeList sorts alphabetically, keyboard flow complete, skip link visible on focus, no API keys in build output
- [ ] T037 Verify GitHub Actions workflow: push to `main` branch triggers `deploy.yml`; build job completes; deploy job publishes to GitHub Pages; site accessible at configured URL; check `base` path in `astro.config.mjs` matches repo name

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story phases (3–6)**: All depend on Phase 2 completion
  - US1 (Phase 3) must complete before US2/US3/US4 can be fully integrated (MapView.vue is the host)
  - US2, US3 can proceed in parallel after Phase 3 scaffold (T014) exists
  - US4 verifies and augments work from US1–US3
- **Polish (Phase 7)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2. Independent — no other story required.
- **US2 (P2)**: Depends on Phase 2 + T014 (MapView.vue scaffold). NodePanel is a child of MapView.
- **US3 (P3)**: Depends on Phase 2 + T014 (MapView.vue scaffold). NodeList is a child of MapView.
- **US4 (P4)**: Depends on US1 (map + keyboard shortcuts), US2 (NodePanel focus behavior), US3 (NodeList focus behavior). Verification task only — no new components.

### Within Each User Story

- Lib modules (Phase 2) before components
- Component scaffold (T014) before child component implementations
- Component implementation before accessibility audit

### Parallel Opportunities

- T003 and T004 (Phase 1): parallel — different npm install commands
- T011 and T012 (Phase 2): parallel — `format.ts` and `popup.ts` are independent files
- T018 and T021 (US2+US3 scaffold): parallel after T014 — different component files
- T019 and T023 (focus-trap setup): parallel — different components
- T020 and T024 (responsive styles): parallel — different component `<style>` blocks
- T025–T029 (US4 verification): sequential review pass through existing files

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Run in parallel (independent files):
Task T010: "Implement src/lib/nodes.ts"
Task T011: "Implement src/lib/format.ts"
Task T012: "Implement src/lib/popup.ts"
Task T013: "Create src/styles/global.css"
```

## Parallel Example: User Story 2 + 3 (after T014)

```bash
# Run in parallel (independent component files):
Task T018: "Implement NodePanel.vue structure"
Task T021: "Implement NodeList.vue structure"

# Then in parallel:
Task T019: "Add focus-trap to NodePanel.vue"
Task T022+T023: "Add arrow keys + focus-trap to NodeList.vue"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T009)
2. Complete Phase 2: Foundational (T010–T013) — CRITICAL
3. Complete Phase 3: User Story 1 (T014–T017)
4. **STOP and VALIDATE**: Open `npm run dev`, verify map loads with markers and clustering
5. Run `npm run build` — verify build passes (and fails correctly on bad plus_code)
6. Deploy / demo as MVP

### Incremental Delivery

1. Setup + Foundational → project scaffolded, all lib functions ready
2. US1 (Phase 3) → map visible with markers **[deployable MVP]**
3. US2 (Phase 4) → popup + detail panel + calendar links work **[core user journey complete]**
4. US3 (Phase 5) → alphabetical list overlay works **[full feature set]**
5. US4 (Phase 6) → keyboard accessibility verified **[WCAG 2.2 AA compliant]**
6. Polish (Phase 7) → production-ready, deployed to GitHub Pages

---

## Notes

- [P] tasks = different files, no shared state dependencies
- [USn] label maps each task to the user story it delivers
- No automated tests — manual verification per quickstart.md checklist (18 items)
- `open-location-code` API: verify with `node -e "const OLC = require('open-location-code'); console.log(typeof OLC.isValid)"` — if `'undefined'`, use `new` constructor pattern (see `research.md` R-003 and quickstart.md Troubleshooting)
- Leaflet CSS must be loaded via `<link>` in `index.astro` `<head>`, NOT via JS imports in Vue component (see `research.md` R-001)
- `MapView.vue` uses `client:only="vue"` — no SSR; never import Leaflet in `.astro` files
- ICS download: use Blob URL in NodePanel.vue (Vue-rendered), data URI in popup.ts (popup HTML string) — per `research.md` R-007
- Commit after each task or checkpoint to enable incremental validation
