# Data Model: PCD Website v2.1

**Branch**: `001-pcd-website-v2` | **Date**: 2026-03-03

---

## Entities

This is a static site with no database. All data originates from `nodes.json` (produced by the upstream data pipeline) and is transformed at build time. There are three conceptual entities: **Node** (stored), **Cluster** (derived), and **CalendarEvent** (derived).

---

## Entity: Node

The primary domain object. Represents a single Processing Community Day 2026 local event.

### Source

`src/data/nodes.json` → loaded by `src/lib/nodes.ts` at Astro build time.

### TypeScript Interface

```ts
// src/lib/nodes.ts

export interface Node {
  // Identity
  id: string;               // Slug: e.g. "pcd-berlin-2026" (slugified name + year; used as ICS UID and React key)
  name: string;             // Display name: e.g. "PCD @ Berlin"

  // Location
  city: string;             // e.g. "Berlin"
  country: string;          // e.g. "Germany"
  venue: string;            // e.g. "Prachtsaal"
  address?: string;         // Physical address (optional) e.g. "Jonasstraße 22, 12053 Berlin"
  plus_code: string;        // Full global Open Location Code: e.g. "9F4MGCFM+PF"
  lat: number;              // Decoded from plus_code at build time (latitudeCenter)
  lng: number;              // Decoded from plus_code at build time (longitudeCenter)

  // Event
  date: string;             // ISO date: "YYYY-MM-DD" — all events are all-day
  website: string;          // Event website URL (required; enforced by data pipeline)
  description: string;      // Short description (always present)
  long_description?: string; // Full description (optional; falls back to description in detail panel)
  organizer_email: string;  // Organizer contact email (required; enforced by data pipeline)
}
```

### JSON Shape (in `nodes.json`)

```json
{
  "nodes": [
    {
      "id": "pcd-berlin-2026",
      "name": "PCD @ Berlin",
      "city": "Berlin",
      "country": "Germany",
      "venue": "Prachtsaal",
      "address": "Jonasstraße 22, 12053 Berlin",
      "date": "2026-10-17",
      "plus_code": "9F4MGCFM+PF",
      "website": "https://creativecode.berlin",
      "description": "A full-day event celebrating creative coding in Berlin.",
      "long_description": "Join us for a full day...",
      "organizer_email": "organizer@example.org"
    }
  ]
}
```

Note: `lat` and `lng` are **not** present in `nodes.json` — they are computed at build time by `loadNodes()`.

### Field Constraints

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `id` | string | ✅ | URL-safe slug; unique across all nodes |
| `name` | string | ✅ | Non-empty |
| `city` | string | ✅ | Non-empty |
| `country` | string | ✅ | Non-empty |
| `venue` | string | ✅ | Non-empty |
| `address` | string | ❌ optional | If absent, map link uses `venue + city + country` |
| `plus_code` | string | ✅ | Must be a **full global** OLC code (≥ 8 chars before `+`, no space); build fails if invalid |
| `lat` | number | computed | Derived from `plus_code` via `open-location-code` |
| `lng` | number | computed | Derived from `plus_code` via `open-location-code` |
| `date` | string | ✅ | ISO 8601 format `YYYY-MM-DD` |
| `website` | string | ✅ | Valid URL (enforced upstream) |
| `description` | string | ✅ | Non-empty; used in popup and calendar |
| `long_description` | string | ❌ optional | If absent, detail panel uses `description` |
| `organizer_email` | string | ✅ | Valid email (enforced upstream) |

### Validation Rules (build-time)

1. **Invalid plus code** → build throws:
   ```
   Error: [nodes] Invalid or short plus_code for "pcd-berlin-2026": "FCCM+PF Berlin".
   All plus codes must be full global codes. Look up the full code at https://plus.codes
   ```
2. **No runtime validation** of other fields — the upstream data pipeline (Google Form → Sheets → CSV → JSON) enforces field presence and format.
3. **XSS safety**: All string fields rendered in Leaflet popup HTML must be passed through `escapeHtml()`. Vue template interpolations are safe by default.

### State Transitions

Not applicable (nodes are static data; no mutable state).

---

## Entity: Cluster

A visual grouping of two or more geographically proximate nodes on the map at a given zoom level.

**Not a stored entity.** Derived dynamically by `leaflet.markercluster` based on node `lat`/`lng` positions and the current map zoom level. Rendered as a styled circle with a count label.

### Derived Properties

| Property | Source |
|----------|--------|
| Count | Number of nodes grouped at current zoom |
| Position | Computed centroid by `leaflet.markercluster` |
| Style | CSS class overrides in `global.css` (red fill, white label) |

---

## Entity: CalendarEvent

A representation of a node suitable for personal calendar import. Derived from `Node` data by `calendarLinks()` in `src/lib/format.ts`.

**Not a stored entity.** Two formats are generated per node:

### Google Calendar URL

```
https://calendar.google.com/calendar/render?action=TEMPLATE
  &text={node.name}
  &dates={YYYYMMDD}/{YYYYMMDD+1}     (all-day, end date exclusive)
  &location={node.venue}, {node.address OR node.city}
  &details={node.description}         (truncated to 500 chars if needed)
```

All values URL-encoded.

### ICS File Content

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PCD2026//EN
BEGIN:VEVENT
UID:{node.id}-{node.date}@pcd2026
DTSTAMP:{build-time UTC timestamp}YYYYMMDDTHHMMSSZ
DTSTART;VALUE=DATE:YYYYMMDD
DTEND;VALUE=DATE:YYYYMMDD+1        (exclusive end date)
SUMMARY:{node.name}
LOCATION:{node.venue}\, {node.address OR node.city\, node.country}
DESCRIPTION:{node.description}
URL:{node.website}
END:VEVENT
END:VCALENDAR
```

Escaping: commas → `\,`, newlines → `\n`, backslashes → `\\`.

Download mechanism: Blob URL generated in Vue component (preferred, Safari-compatible) or data URI pre-built in popup HTML string.

---

## Module Responsibilities

| Module | Reads | Produces | Side Effects |
|--------|-------|----------|-------------|
| `src/lib/nodes.ts` | `nodes.json` file | `Node[]` with `lat`/`lng` | Throws on invalid plus code |
| `src/lib/format.ts` | `Node` | `string` (formatted date), `{ googleCalUrl, icsContent }` | None |
| `src/lib/popup.ts` | `Node` | HTML string | None |
| `src/pages/index.astro` | `Node[]` (via `loadNodes()`) | Rendered HTML | None |
| `src/components/MapView.vue` | `Node[]` (prop) | Leaflet map DOM | Map init, event listeners |
| `src/components/NodePanel.vue` | `Node | null` (prop) | Slide-in panel DOM | Focus trap |
| `src/components/NodeList.vue` | `Node[], boolean` (props) | Overlay DOM | Focus trap |
