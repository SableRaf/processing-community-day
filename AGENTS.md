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
node --test .github/scripts/event-issue-helpers.test.mjs
node --test .github/scripts/process-new-event-issue.test.mjs
node --test .github/scripts/process-edit-event-issue.test.mjs
node --test .github/scripts/plus-code.test.mjs
node --test .github/scripts/zines.test.mjs
node --test .github/scripts/zine-build.test.mjs
node --test .github/scripts/process-new-zine-issue.test.mjs

# Requires npm run build from pcd-website/ first:
node --test .github/scripts/data-json.test.mjs
```

Need to run the tests end-to-end? `./scripts/run-tests.sh` executes the helper, event and zine intake, plus-code, and zine metadata suites; runs the zine fixture build; builds the Astro site via `npm --prefix pcd-website run build`; and then runs `data-json.test.mjs` in sequence. Run this script from the repo root after installing dependencies so you get the full battery of checks in one shot.

No install needed — `open-location-code` is already available at `pcd-website/node_modules/`.

### Testing protocol

- Tests live alongside the code they test in `.github/scripts/`.
- Use `node:test` + `node:assert` (built into Node — no test framework needed).
- Mock `globalThis.fetch` with `beforeEach`/`afterEach` for any test that triggers a Nominatim call; always restore the original after each test.
- When adding new functions to `.github/scripts/`, extract pure/testable logic into a separate `*.mjs` module (as was done for `plus-code.mjs`) so it can be imported without triggering the main script's top-level side effects.

## Architecture

### Astro + Vue split

- **Astro** owns routing, layouts, metadata, and static content pages. `src/layouts/BaseLayout.astro` provides the document shell; `MapLayout.astro`, `SiteLayout.astro`, and `DocsLayout.astro` provide the map, standard content, and Organizer Kit shells respectively.
- **Vue** handles the interactive map UI as `client:only="vue"` island components. Map-specific interactive features belong in Vue; static site and Organizer Kit pages belong in Astro and Markdown content collections.

### Data loading at build time

Event data lives in `src/content/events/<event-id>/`:
- `metadata.json` — event fields (id, uid, name, location, dates, organizers, etc.)
- `content.md` — markdown body (frontmatter must include `id:` and `uid:`)
  - `uid:` values in frontmatter **must always be quoted** (`uid: "abc1234"`) because unquoted hex strings like `1e46977` are parsed as scientific notation by YAML, destroying the value.

`src/lib/nodes.ts` loads all events at Astro build time using `import.meta.glob()` + `getCollection('events')`, validates plus codes with `OpenLocationCode`, decodes lat/lng, and returns a sorted `Node[]` array passed as props to `<MapView>`.

Zine cards live in `src/content/zines/<slug>/` and the library grid at `/organize/zines/zine-library/` is built dynamically from every `*/index.md`, sorted by its required numeric `order` frontmatter. Every published zine has `index.md`, `metadata.json`, an optional root-level cover image, and a `downloads/` directory. Metadata uses a non-empty generic `downloads` array: local records are `{ file, file_size, role? }` (where `file` is a basename in `downloads/`), and manually maintained external records use `{ url, filename, file_size, role? }`; roles are optionally `reader-order` or `print-ready`. Metadata also requires an event-style `intake` object with `issue_number`, `submitted_by_github`, `submitted_date`, and `maintainer_notes`; the zine detail page links the submitted date to the issue and the username to the submitter's GitHub profile. Root image imports are covers only; opaque downloads import from `*/downloads/` using `?url&no-inline`, while image downloads are emitted from that same directory via Astro's image asset helper. Set optional `created_by_url` in metadata to an http(s) page for the credited creator(s); the detail page links the author name when it is present. Optional `tags` and `languages` are arrays of non-empty strings. Optional `activity_type` describes how the guide is used, while `zine_format` describes publication structure; do not combine them under a generic `format` field. Cover metadata uses `{ "src": "cover.png", "alt": "..." }`. Zines must use `index.md` (not `content.md`) so Astro's glob loader makes the entry id equal to the folder slug. A zine without a cover renders a grey title fallback in the library and detail page.

The `Zine Intake` workflow produces final content directly in `src/content/zines/<slug>/`. Submitters attach files only through GitHub issue-form fields: exactly one reader-order PDF and one print-ready PDF, optional PNG/JPG/JPEG/WebP cover, and optional PDF/ZIP/image/TXT/MD/CSV/JSON supplements. The limits are ten files total, 25 MB per non-image, 10 MB per image, and 50 MB total. Attachment URLs must be GitHub uploads; both Markdown upload links/images and GitHub-generated HTML `<img>` embeds are accepted. When an embedded image URL has no filename, the workflow derives its extension from the validated file signature. The workflow follows only approved GitHub object-store redirects, validates signatures/UTF-8/JSON content, assigns title-derived cover alt text, and writes original filenames (with lowercase extensions) into `downloads/`. Cover and download filenames are separate namespaces, while download filenames must be case-insensitively unique. It builds the Astro site before force-updating the automation-owned `automation/new-zine-<issue-number>` review branch. An invalid later edit preserves the last valid PR commit, marks the PR `needs changes`, and a subsequent valid edit restores `needs review`; maintainer notes are retained in the PR body. Review PDFs for selectable text, logical reading order, document title and language, tagged headings where possible, alt text, and at least one screen-reader-friendly reading-order version.

The global Markdown pipeline runs `rehype-table-wrapper` and `rehype-heading-anchors`, which respectively wrap rendered tables in `.table-wrapper` and add permalink anchors to h2–h6. Their presentation styles live in the shared `prose.css` layer, scoped to both `.prose` and `.docs-prose`, because both plugins apply to all Markdown collections. For a styled caption immediately after a Markdown image, use `<span class="prose-figure-caption">…</span>` on the next line; it supports normal Markdown links for attribution.

**If a plus_code is invalid or too short, the build fails with a clear error — this is intentional.**

**"Confirmed" events in data.json:** An event is included in the `/data.json` feed if it is present in `loadNodes()` and has no `placeholder: true` flag. There are currently no other event states (draft, hidden, etc.). If new states are added in future, the filter in `src/pages/data.json.ts` must be updated explicitly.

### Key implementation details

- **Leaflet CSS** is loaded via `<link>` tags in `MapLayout.astro`, NOT via JS imports — avoids SSR issues since MapView is `client:only="vue"`.
- **Docs page share actions** render `ShareMenu.vue` with `client:load` so the control is present in the initial HTML and hydrates immediately. Keep `vue-i18n` in Vite's `ssr.noExternal` list so this server render can resolve its compile-time feature flags.
- **Browser storage** must be accessed through `src/lib/safeStorage.mjs`; direct `localStorage` property access can throw under iOS privacy restrictions and abort Vue island hydration.
- **Transient feedback** uses `Snackbar.vue`. Pass a translated message and close label, and mount each new notification with a unique `key` so its dismiss timeout and circular timer restart. Snackbar close controls and modal close controls share the global `.modal-close-button` style from `base.css`.
- **`open-location-code`** exports `{ OpenLocationCode }` as a named export — use `new OpenLocationCode()` (not static methods).
- **`leaflet.markercluster`** causes a circular dependency warning, suppressed via `rollupOptions.onwarn` in `astro.config.mjs`.
- **Deep linking:** `?event=<id-or-uid>` query param auto-opens the event detail panel. Both the slug `id` and the short `uid` are accepted.
- **Event UIDs:** Each event has a stable 7-char hex `uid` stored in both `metadata.json` and `content.md` frontmatter. UIDs never change after creation. Three static URL formats are generated per event: `/event/<slug>` (redirects to canonical), `/event/<slug>-<uid>` (canonical, has OG tags, redirects into SPA), and `/event/<uid>` (short form, redirects to canonical). The canonical URL is what the share button copies.

### Component roles

| File | Role |
|---|---|
| `src/components/MapView.vue` | Leaflet map, marker clustering, keyboard shortcuts |
| `src/components/NodePanel.vue` | Slide-in event detail panel with minimap, calendar links, share button |
| `src/components/LanguageSwitcher.vue` | Language selector dropdown in the top bar |
| `src/components/BackButton.astro` | Reusable button-style link for navigating from a detail page back to its parent listing |
| `src/components/DocsPageActions.astro` | Reusable share dropdown (Markdown, permalink, QR code) and GitHub edit action used by Organizer Kit and zine detail pages |
| `src/components/ShareMenu.vue` | Shared Markdown, permalink, and QR-code menu used by docs actions and the event detail panel |
| `src/components/Snackbar.vue` | Reusable auto-dismissing feedback snackbar with an accessible close control and circular countdown |
| `src/directives/touchActivate.ts` | Direct-touch activation for buttons affected by iOS WebKit's unreliable synthesized clicks |
| `src/components/ZineDownloads.astro` | Renders zine download rows with a button, filename, and human-readable file size |
| `src/components/Header.astro` | Shared fixed site header and primary navigation |
| `src/components/Footer.astro` | Shared site footer, policy links, community links, and sponsors |
| `src/layouts/BaseLayout.astro` | Shared HTML document shell and metadata |
| `src/layouts/MapLayout.astro` | Map-page shell and Leaflet stylesheet links |
| `src/layouts/SiteLayout.astro` | Standard static content-page shell |
| `src/layouts/DocsLayout.astro` | Organizer Kit shell with sidebar, page TOC, and footer |
| `src/lib/analytics.ts` | `trackEvent()` Fathom helper + `AnalyticsEvent` type + event-name constants |
| `src/lib/carto.ts` | Adds the optional local-development CARTO API key to basemap tile URLs |
| `src/lib/safeStorage.mjs` | Guards localStorage reads and writes so browser privacy settings cannot abort hydration |
| `src/lib/nodes.ts` | `Node` interface + `loadNodes()` |
| `src/lib/format.ts` | `formatDate()`, `formatDateRange()`, `calendarLinks()`, etc. |
| `src/lib/popup.ts` | Leaflet popup HTML generation (`makePopupContent()`) |
| `src/styles/base.css` | Shared design tokens, reset, typography, focus, and skip-link styles |
| `src/styles/map.css` | Map layout, controls, popup styling, and Leaflet overrides |
| `src/styles/prose.css` | Standard static content-page presentation styles |
| `src/styles/docs/*.css` | Organizer Kit's modular Just-the-Docs-derived tokens, layout, navigation, and Markdown presentation styles |
| `src/lib/rehype-table-wrapper.mjs` | Markdown rehype plugin that wraps rendered tables for horizontal scrolling |
| `src/pages/data.json.ts` | Static JSON feed of confirmed events, served at /data.json |
| `src/pages/activity-guide/[id].astro` | Standalone zine pages |
| `src/lib/zines.ts` | Build-time zine loader and topic-slot mapping |
| `src/lib/zine-metadata.js` | Zine schema and pure metadata/asset validation |
| `src/content.config.ts` | Astro content collection Zod schemas for events, legal pages, Organizer Kit, and zines |
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

For local map development, `pcd-website/.env` may define `PUBLIC_CARTO_API_KEY`. During `npm run dev`, all CARTO raster tile URLs append it as the `key` query parameter; production builds do not embed it.

## UI / Styling Rules

- The site is light-mode only — there is no dark mode, no `[data-theme]` toggling, and no theme-related CSS. Do not reintroduce it without an explicit decision to do so.

## Accessibility

Must follow standard accessibility best practices (semantic HTML, ARIA attributes, keyboard navigation, focus management) for all interactive components (map, panels, buttons, etc.). WCAG 2.1 AA compliance is the goal.

## Event Submission Workflow

### New events

New events are submitted via GitHub Issues using `.github/ISSUE_TEMPLATE/01-new-event.yml`. The workflow `.github/workflows/new-event-intake.yml` (`process-new-event` job) runs `.github/scripts/process-new-event-issue.mjs` to validate the issue and, if valid, opens a PR with generated `metadata.json` + `content.md` files. A stable `uid` is generated at intake and written into both files.

### Edit events

Organizers can edit existing events via `.github/ISSUE_TEMPLATE/04-edit-event.yml`. The same workflow (`process-edit-event` job) runs `.github/scripts/process-edit-event-issue.mjs`. The edit script: reads the existing event by `event_id`, preserves the immutable `uid` and `intake` block, preserves `event_activities` if all checkboxes are unchecked (GitHub issue forms cannot prefill checkboxes), and preserves `content.md` if `full_description` is blank.

### New zines

New zines use `.github/ISSUE_TEMPLATE/05-new-zine.yml` and `.github/workflows/new-zine-intake.yml`. The workflow runs `.github/scripts/process-new-zine-issue.mjs` when an issue labelled `new zine` is opened, edited, reopened, or labelled. It validates and downloads attachments, generates final published files with an event-style `intake` provenance block, builds the site, and force-updates the stable automation-owned `automation/new-zine-<issue-number>` review PR. It upserts one marked status comment; invalid edits leave an existing valid PR unchanged. Zines have no edit issue workflow.

### Shared helpers

Pure functions shared by both intake scripts live in `.github/scripts/event-issue-helpers.mjs`. This includes `parseIssueSections`, validation helpers, `slugify`, `parseActivities`, `parseOrganizers`, `buildValidationComment`, and `generateUniqueUid`.

### Template detection

Intake scripts guard against running on the wrong template:
- `process-new-event-issue.mjs` skips if the body contains `### Event ID` (unique to the edit template)
- `process-edit-event-issue.mjs` skips if the body does NOT contain `### Event ID`
- `process-new-zine-issue.mjs` skips unless the body contains `### Reader-order PDF` (which also matches the former `### Reader-order PDF URL` heading)

## Deployment

Netlify, configured via `netlify.toml`. The site deploys to `https://day.processing.org/` on push to `main`.

The browser-facing CARTO tile key is supplied at build time through
`PUBLIC_CARTO_API_KEY`. Configure it as a Netlify environment variable with
Builds scope; for local development it may be placed in `pcd-website/.env`.
Never commit the key. Without it, the site falls back to unkeyed tile URLs for
local development and may display CARTO's API-key watermark.
