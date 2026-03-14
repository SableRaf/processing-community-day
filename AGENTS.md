# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

When making changes to the codebase, please also update this file as needed to reflect any new patterns, tools, or workflows that agents should be aware of. Especially when refactors or architectural changes are made, please update the "Architecture" and "Tech Stack" sections to reflect the new structure and technologies used in the project.

## Project Overview

Static website for Processing Community Day (PCD) 2026 — a global map of events. Built with Astro 5 (static output) + Vue 3 + Leaflet. No backend, no database, no API calls at runtime.

The Astro project root is `pcd-website/`. All build commands run from there.

## Build Commands

All from the `pcd-website/` directory:

```sh
npm install
npm run dev      # localhost:4321
npm run build    # production build → dist/
npm run preview  # preview production build
```

There are currently no test or lint scripts configured.

## Architecture

### Astro + Vue split

- **Astro** (`src/pages/index.astro`) is the single entry point — a static HTML shell with `<head>`, font/CSS links, and BASE_URL injection. No new Astro pages should be added.
- **Vue** handles all interactive UI as `client:only="vue"` island components. New UI features go in Vue components, not Astro pages.

### Data loading at build time

Event data lives in `src/content/events/<event-id>/`:
- `metadata.json` — event fields (id, name, location, dates, organizers, etc.)
- `content.md` — markdown body (frontmatter must include `id:`)

`src/lib/nodes.ts` loads all events at Astro build time using `import.meta.glob()` + `getCollection('events')`, validates plus codes with `OpenLocationCode`, decodes lat/lng, and returns a sorted `Node[]` array passed as props to `<MapView>`.

**If a plus_code is invalid or too short, the build fails with a clear error — this is intentional.**

### Key implementation details

- **Leaflet CSS** is loaded via `<link>` tags in `index.astro`, NOT via JS imports — avoids SSR issues since MapView is `client:only="vue"`.
- **`open-location-code`** exports `{ OpenLocationCode }` as a named export — use `new OpenLocationCode()` (not static methods).
- **`leaflet.markercluster`** causes a circular dependency warning, suppressed via `rollupOptions.onwarn` in `astro.config.mjs`.
- **Deep linking:** `?event=<id>` query param auto-opens the event detail panel.
- **Map style preference** persisted in `localStorage`.

### Component roles

| File | Role |
|---|---|
| `src/components/MapView.vue` | Leaflet map, marker clustering, keyboard shortcuts, tile layer switching |
| `src/components/NodePanel.vue` | Slide-in event detail panel with minimap, calendar links, share button |
| `src/components/NodeList.vue` | Alphabetical event list overlay with map style switcher + dark mode toggle |
| `src/lib/nodes.ts` | `Node` interface + `loadNodes()` |
| `src/lib/format.ts` | `formatDate()`, `formatDateRange()`, `calendarLinks()`, etc. |
| `src/lib/popup.ts` | Leaflet popup HTML generation (`makePopupContent()`) |
| `src/styles/global.css` | Design tokens (CSS custom properties), IBM Plex Sans, Leaflet overrides |
| `src/content.config.ts` | Astro content collection Zod schema for events |

## UI / Styling Rules

- Always support both light and dark mode for any new or modified UI elements.
- Dark mode is toggled via `[data-theme="dark"]` on `<html>` (set by `NodeList.vue`).
- Dark mode uses CSS custom properties defined in `global.css` under `[data-theme="dark"]`.
- **Vue scoped styles cannot target ancestor-based dark mode selectors** — put those overrides in `global.css`.

## Accessibility

Must follow standard accessibility best practices (semantic HTML, ARIA attributes, keyboard navigation, focus management) for all interactive components (map, panels, buttons, etc.). WCAG 2.1 AA compliance is the goal.

## Event Submission Workflow

New events are submitted via GitHub Issues using `.github/ISSUE_TEMPLATE/new-event.yml`. The workflow `.github/workflows/new-event-intake.yml` runs `.github/scripts/process-new-event-issue.mjs` to validate the issue and, if valid, opens a PR with generated `metadata.json` + `content.md` files.

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`. Triggered on push to `main` (for paths under `pcd-website/`). The site base path is `/pcd-website-mvp-2` (set in `astro.config.mjs`).
