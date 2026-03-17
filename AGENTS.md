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

There are currently no lint scripts configured.

## Tests

See [TEST.md](TEST.md) for the full test inventory and coverage notes.

### Running tests

```sh
node --test .github/scripts/plus-code.test.mjs
```

No install needed — `open-location-code` is already available at `pcd-website/node_modules/`.

### Testing protocol

- Tests live alongside the code they test in `.github/scripts/`.
- Use `node:test` + `node:assert` (built into Node — no test framework needed).
- Mock `globalThis.fetch` with `beforeEach`/`afterEach` for any test that triggers a Nominatim call; always restore the original after each test.
- When adding new functions to `.github/scripts/`, extract pure/testable logic into a separate `*.mjs` module (as was done for `plus-code.mjs`) so it can be imported without triggering the main script's top-level side effects.

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
| `src/components/LanguageSwitcher.vue` | Language selector dropdown in the top bar |
| `src/lib/nodes.ts` | `Node` interface + `loadNodes()` |
| `src/lib/format.ts` | `formatDate()`, `formatDateRange()`, `calendarLinks()`, etc. |
| `src/lib/popup.ts` | Leaflet popup HTML generation (`makePopupContent()`) |
| `src/styles/global.css` | Design tokens (CSS custom properties), IBM Plex Sans, Leaflet overrides |
| `src/content.config.ts` | Astro content collection Zod schema for events |
| `src/config.ts` | Global static constants (contact email, etc.) |
| `src/i18n/index.ts` | Creates the `vue-i18n` instance and exports `syncLocale()` |
| `src/i18n/localeState.ts` | Reactive `currentLocale` ref, browser detection, localStorage persistence |
| `src/i18n/vuePlugin.ts` | Astro `appEntrypoint` — installs `vue-i18n` on every Vue island |
| `src/i18n/locales/en.json` | Source-of-truth translation file (all keys must exist here) |
| `src/i18n/locales/*.json` | Per-language translations (es, de, fr, pt, zh-TW, zh-CN, ja, ko) |

## Internationalization (i18n)

The site uses `vue-i18n@11` with 9 supported locales: `en`, `es`, `de`, `fr`, `pt`, `zh-TW`, `zh-CN`, `ja`, `ko`.

### How it's wired up

- `vue-i18n` is installed globally via `astro.config.mjs` → `vue({ appEntrypoint: '/src/i18n/vuePlugin' })`.
- Locale detection order: localStorage (`pcd-locale`) → `navigator.language` → `'en'`.
- The active locale is a reactive singleton (`currentLocale` ref in `localeState.ts`) shared across all components.

### Adding or changing UI strings

1. **Always add the key to `en.json` first.** It is the source of truth and the fallback for all other locales.
2. Add the same key to every other locale file in `src/i18n/locales/`. Missing keys fall back to English silently.
3. In Vue components, use `const { t, locale } = useI18n()` and replace hardcoded text with `t('key')`.
4. In non-component TS files (e.g. `popup.ts`), use `i18n.global.t('key')` imported from `src/i18n/index.ts`.
5. Pass `locale` (or `locale.value` as a string) to `formatDateRange()`, `formatDate()`, etc. for locale-aware date formatting.

### What NOT to translate

Event data coming from content files — `event_name`, `details_text`, `city`, `country`, `organization_name`, organizer names, URLs — must never be wrapped in `t()`. Only static UI strings get translated.

### Non-English word choices

Non-English locales use "Events" (not "Nodes") in list/dialog labels, since "Nodes" is a technical term that doesn't translate naturally.

## Global Configuration (`src/config.ts`)

Use `src/config.ts` for static, non-secret values that are referenced across multiple files or are likely to change. Import from it rather than hardcoding inline.

**Store here:**
- Contact emails (e.g. `PCD_EMAIL`)
- Stable URLs referenced in UI (e.g. a feedback form link)
- Project-wide constants (e.g. site name, org name)

**Do not store here:**
- Environment-specific or secret values — use `.env` with `import.meta.env` for those
- Anything already defined in `astro.config.mjs` (e.g. base path)
- Component-local constants that aren't shared

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

Netlify, configured via `netlify.toml`. The site deploys to `https://day.processing.org/` on push to `main`.
