# Research: PCD Website v2.1

**Branch**: `001-pcd-website-v2` | **Date**: 2026-03-03
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## R-001: Astro + Vue 3 + Leaflet Integration Pattern

**Decision**: Use `client:only="vue"` on `MapView.vue`. Load all Leaflet CSS via `<link>` tags in `index.astro` `<head>`, never via JS `import` inside the Vue component.

**Rationale**: `client:only="vue"` skips SSR entirely for the component. Leaflet accesses `window` and `document` at import time — any directive that allows SSR (`client:load`, `client:idle`, etc.) will throw `window is not defined` during the Astro build. Leaflet CSS imported as a JS module inside a `client:only` component is not extracted during the static build, causing unstyled/broken tiles.

**Alternatives considered**: `client:load` with dynamic imports in `onMounted` — works but is more verbose with no benefit. `client:only` is the canonical Astro pattern for third-party DOM-dependent libraries.

**Key detail**: Top-level `import L from 'leaflet'` is safe inside a `client:only` component because the code never runs in Node.js. Dynamic import inside `onMounted` is only needed when not using `client:only`.

---

## R-002: Astro Version Selection

**Decision**: Use **Astro 5.x** + `@astrojs/vue` 5.x + Vue 3.5.x.

**Rationale**: Astro 5 is the current stable series (released October 2024). For a static site using Vue component islands, Astro 4.x and 5.x are functionally equivalent in the relevant areas. Astro 5 is preferred as the supported version.

**Configuration**:
```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';

export default defineConfig({
  output: 'static',
  site: 'https://<org>.github.io',
  base: '/<repository-name>',   // omit if deploying to <org>.github.io root
  integrations: [vue()],
});
```

---

## R-003: `open-location-code` npm Package API

**Decision**: The `open-location-code` package exports **static methods directly** — no `new` keyword required. Decoded coordinates are in `decoded.latitudeCenter` and `decoded.longitudeCenter`.

**Rationale**: The package exports a plain object/namespace with static functions. Usage:
```ts
import OpenLocationCode from 'open-location-code';

OpenLocationCode.isValid(code: string): boolean
OpenLocationCode.isFull(code: string): boolean
OpenLocationCode.decode(code: string): {
  latitudeCenter: number;
  longitudeCenter: number;
  latitudeLo: number; longitudeLo: number;
  latitudeHi: number; longitudeHi: number;
  codeLength: number;
}
```

**Verify after install**: `node -e "const OLC = require('open-location-code'); console.log(typeof OLC.isValid)"` — should print `'function'`. If `'undefined'`, the package exports a class and requires `new OpenLocationCode()`.

**Alternatives considered**: `@google/open-location-code` (scoped package) — same algorithm, no advantage. Manual API geocoding — violates "no API keys" constraint.

---

## R-004: `focus-trap` in Vue 3 (Composition API)

**Decision**: Use `createFocusTrap(element, options)` in `onMounted()`, store in a variable, and call `.activate()` / `.deactivate()` via `watch()` on the controlling prop. No Vue wrapper package needed.

**Rationale**: `focus-trap` is framework-agnostic. Ships its own TypeScript declarations (v7+) — no `@types/focus-trap` needed.

**Pattern for NodePanel.vue**:
```ts
import { createFocusTrap, type FocusTrap } from 'focus-trap';
let trap: FocusTrap | null = null;

onMounted(() => {
  trap = createFocusTrap(panelRef.value!, {
    initialFocus: () => closeButtonRef.value ?? panelRef.value!,
    onDeactivate: () => emit('close'),
    returnFocusOnDeactivate: false, // handle focus return manually
    escapeDeactivates: true,
    allowOutsideClick: true,
  });
});

watch(() => props.node, (newNode) => {
  if (newNode) trap?.activate();
  else {
    trap?.deactivate();
    document.getElementById('map')?.focus();
  }
});

onUnmounted(() => trap?.deactivate());
```

**Pattern for NodeList.vue**: Same, but `initialFocus` targets the first list item button; `onDeactivate` emits `'close'`; focus returns to burger menu button on close.

**Arrow key navigation** is separate from focus-trap — implement via `keydown` listener on the list container.

---

## R-005: GitHub Pages + Astro Deployment

**Decision**: Use the official `actions/deploy-pages` workflow. Set `site` and `base` in `astro.config.mjs`. Configure repo Pages source to "GitHub Actions".

**Rationale**: The spec (FR-037) requires GitHub Pages via GitHub Actions. The `withastro/action` or the manual `upload-pages-artifact` + `deploy-pages` workflow are both supported. The Astro `.nojekyll` file is created automatically in `dist/`.

**GitHub Actions workflow** (`.github/workflows/deploy.yml`):
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

**Note on base path**: If the repository is `<org>/pcd-website` and deploys to `<org>.github.io/pcd-website`, set `base: '/pcd-website'` in `astro.config.mjs`. If it deploys to a custom domain at root, omit `base`. Hard-coded asset paths (like `href="/favicon.ico"`) must use `import.meta.env.BASE_URL` prefix.

**Alternatives considered**: Netlify (what the PRD describes) — simpler, no `base` config needed, connect repo and set `npm run build` / `dist`. If the deployment target changes to Netlify, remove `base` from config and add `netlify.toml` from the PRD.

---

## R-006: `leaflet.markercluster` Compatibility

**Decision**: `leaflet.markercluster` 1.5.x is compatible with Leaflet 1.9.x. Import as side-effect after Leaflet. Install `@types/leaflet.markercluster` for TypeScript.

**Rationale**: The packages are co-maintained and Leaflet 1.x is the supported target. `leaflet.markercluster` augments the `L` namespace — no named export, import order matters.

**Install**:
```
npm install leaflet leaflet.markercluster
npm install --save-dev @types/leaflet @types/leaflet.markercluster
```

**Import**:
```ts
import L from 'leaflet';
import 'leaflet.markercluster'; // augments L.markerClusterGroup
```

**Known gotcha**: Vite/Rollup may warn about circular dependencies in `leaflet.markercluster`. Suppress in `astro.config.mjs`:
```js
vite: { build: { rollupOptions: { onwarn(w, warn) { if (w.code === 'CIRCULAR_DEPENDENCY') return; warn(w); } } } }
```

---

## R-007: ICS / iCalendar All-Day Event Format

**Decision**: Use `DTSTART;VALUE=DATE:YYYYMMDD` / `DTEND;VALUE=DATE:YYYYMMDD` where DTEND is exclusive (day after last day). Escape commas as `\,` and newlines as `\n` in LOCATION/DESCRIPTION. Use Blob URL approach for download instead of raw data URI for Safari/iOS compatibility.

**Rationale**: RFC 5545 §3.6.1 defines the all-day event format. DTEND is exclusive by spec. Data URIs with `download` attribute work in Chrome/Firefox but are unreliable on iOS Safari.

**Required VEVENT fields**: `DTSTART`, `DTSTAMP`, `UID`. Strongly recommended: `DTEND`, `SUMMARY`, `DESCRIPTION`, `LOCATION`, `URL`.

**Blob URL pattern** (more reliable than data URI):
```ts
const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
const url = URL.createObjectURL(blob);
// attach to <a download="event.ics" href={url}>
// revoke after click
```

**Alternative**: The PRD specifies data URI format. Since this is a static site with no JS-generated links at click time (links are pre-built in popup HTML strings), the data URI approach is used for the popup links. For the Vue-rendered NodePanel links, the Blob URL approach is preferred.

---

## R-008: WCAG 2.2 AA — Focus Indicator Requirements

**Decision**: SC 2.4.11 requires the focus indicator pixel area to be ≥ the area of a 2 CSS px perimeter around the component, with ≥ 3:1 contrast between focused and unfocused states of those pixels.

**Rationale**: This is less strict than it sounds — a `2px solid` CSS outline on a button typically satisfies both conditions automatically if the outline color has 3:1 contrast against the button background.

**Practical implementation**: Use `outline: 2px solid #005fcc` (or similar high-contrast color) on `:focus-visible`. Remove `outline: none` from any resets. Browser defaults pass in most cases if not overridden.

---

## R-009: ARIA Dialog Pattern Requirements

**Decision**: Use `role="dialog"` + `aria-labelledby` (referencing visible heading) + `aria-modal="true"` on dialog containers. Move focus to close button on open. Return focus to trigger element on close.

**Rationale**: WAI-ARIA APG "Dialog (Modal)" pattern. `aria-modal="true"` signals inert background to screen readers but does NOT replace JavaScript focus trapping (browser/AT support varies). Both are needed.

**Required attributes on dialog container**:
- `role="dialog"` — required
- `aria-labelledby` — preferred (references visible heading ID)
- `aria-modal="true"` — recommended for modal dialogs
- `tabindex="-1"` on container — allows programmatic focus if no other focusable target

**Focus on open**: First focusable element, or close button, or heading element.
**Focus on close**: Return to trigger element (stored reference before opening).

---

## R-010: Google Calendar URL Format

**Decision**: Use `https://calendar.google.com/calendar/render?action=TEMPLATE` with parameters `text`, `dates` (format: `YYYYMMDD/YYYYMMDD` for all-day, end is exclusive), `location`, `details`. All values URL-encoded.

**Rationale**: This URL has been stable for many years. All values must be URI-encoded. Newlines in `details` are `%0A`.

**All-day example**:
```
https://calendar.google.com/calendar/render?action=TEMPLATE
  &text=PCD%20%40%20Berlin
  &dates=20261017%2F20261018
  &location=Prachtsaal%2C%20Jonas...
  &details=Join%20us%20in%20Berlin...
```

End date for an October 17 all-day event = `20261018` (exclusive, same as iCal convention).
