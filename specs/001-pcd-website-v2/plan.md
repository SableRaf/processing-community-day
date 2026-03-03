# Implementation Plan: PCD Website v2.1

**Branch**: `001-pcd-website-v2` | **Date**: 2026-03-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-pcd-website-v2/spec.md`

## Summary

Build a fully static Processing Community Day 2026 website that displays globally distributed events ("nodes") on an interactive Leaflet world map. Node data is loaded from a static JSON file at Astro build time; all rendering and interactivity runs client-side only. The site requires no API keys, no backend, and no database. It must be fully keyboard-accessible (WCAG 2.2 AA), support alphabetical node browsing via an overlay panel, and deploy automatically to GitHub Pages on push to main.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: Astro 5.x (static output), Vue 3, Leaflet 1.9, leaflet.markercluster, open-location-code, focus-trap, IBM Plex Sans (Google Fonts)
**Storage**: Static JSON file (`src/data/nodes.json`) — no database, no runtime persistence
**Testing**: No automated tests (out of scope per spec); manual accessibility verification
**Target Platform**: Evergreen browsers (Chrome, Firefox, Safari, Edge); GitHub Pages (static CDN)
**Project Type**: Static website / client-side web application
**Performance Goals**: Full map + markers visible in < 3 seconds on standard broadband; 10–40 nodes (no pagination needed)
**Constraints**: No API keys; no server runtime; fully offline-buildable except tile CDNs; WCAG 2.2 AA conformance
**Scale/Scope**: ~10–40 nodes; single-page application; 5 source files + 3 components

## Constitution Check

*No project constitution exists — evaluating against universal software quality gates.*

| Gate | Status | Notes |
|------|--------|-------|
| Single responsibility | ✅ PASS | Each module has one job: `nodes.ts` loads/decodes data, `format.ts` formats, `popup.ts` builds HTML, components handle UI |
| No unnecessary complexity | ✅ PASS | Single-project, no monorepo, no state management library, no router |
| Security: XSS prevention | ✅ PASS | `escapeHtml()` helper for all Leaflet popup interpolations; Vue templates auto-escape |
| No hardcoded secrets | ✅ PASS | No API keys required; Stadia Maps key would be env var if used |
| Build must be reproducible | ✅ PASS | All data from static `nodes.json`; deterministic build |
| Accessibility compliance | ✅ PASS | WCAG 2.2 AA explicitly required; focus trap, ARIA roles, keyboard shortcuts specified |

*No violations. Complexity Tracking table not required.*

## Project Structure

### Documentation (this feature)

```text
specs/001-pcd-website-v2/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── node-schema.md   # nodes.json data contract
│   └── component-api.md # Vue component props/emits contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── pages/
│   └── index.astro          # Page shell: loads nodes at build time, passes to MapView
├── components/
│   ├── MapView.vue           # Leaflet map, custom SVG markers, clustering, keyboard shortcuts
│   ├── NodePanel.vue         # Slide-in detail panel: full description + all links
│   └── NodeList.vue          # Burger menu overlay: flat alphabetical list of nodes
├── lib/
│   ├── nodes.ts              # loadNodes(): reads nodes.json, decodes plus codes → {lat, lng}
│   ├── format.ts             # formatDate(), calendarLinks() — pure functions, no DOM
│   └── popup.ts              # makePopupContent(), escapeHtml() — popup HTML builder
├── styles/
│   └── global.css            # Design tokens, resets, IBM Plex Sans import, popup + cluster styles
└── data/
    └── nodes.json            # Static node data (copied from MVP data pipeline output)

public/                       # Static assets (favicon, etc.)

.github/
└── workflows/
    └── deploy.yml            # GitHub Actions: build → deploy to GitHub Pages

astro.config.mjs              # Astro config: static output, Vue integration, base path
tsconfig.json
package.json
```

**Structure Decision**: Single-project web application. All source in `src/`, no backend, no monorepo. Matches Astro's recommended layout for a static site with Vue component islands.

## Complexity Tracking

*No constitution violations — table not required.*

---

## Post-Design Constitution Check

*Re-evaluated after Phase 1 design artifacts (data-model.md, contracts/, quickstart.md).*

| Gate | Status | Notes |
|------|--------|-------|
| Single responsibility | ✅ PASS | Confirmed: 3 lib modules (load, format, popup), 3 Vue components (Map, Panel, List), 1 page. No crossover. |
| No unnecessary complexity | ✅ PASS | No new abstractions introduced. `calendarLinks()` returns `{ googleCalUrl, icsContent }` as a plain object — no class. |
| Security: XSS prevention | ✅ PASS | `escapeHtml()` contract documented; all popup template slots identified in `contracts/component-api.md`. Vue templates safe by default. |
| No hardcoded secrets | ✅ PASS | No secrets anywhere. `astro.config.mjs` has no API keys. Optional Stadia Maps key would be injected via env var at deploy time. |
| Interface contracts defined | ✅ PASS | `contracts/node-schema.md` documents the JSON data contract. `contracts/component-api.md` documents all Vue props/emits. |
| Build reproducibility | ✅ PASS | `npm ci` + static JSON → deterministic output. No network calls at build time except tile CDN at runtime. |
| Accessibility contract | ✅ PASS | ARIA attributes and focus management fully specified per WAI-ARIA APG dialog pattern in component-api.md. |

*No violations post-design. Implementation may proceed.*
