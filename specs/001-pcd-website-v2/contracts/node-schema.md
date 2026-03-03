# Contract: nodes.json Data Schema

**Branch**: `001-pcd-website-v2` | **Date**: 2026-03-03
**Consumer**: `src/lib/nodes.ts` (Astro build time)
**Producer**: Upstream data pipeline (Google Form → Sheets → CSV → JSON, out of scope)

---

## Overview

`nodes.json` is the sole runtime data dependency of the PCD website. It is a static JSON file placed at `src/data/nodes.json`. The website build reads it once at build time via `loadNodes()` and embeds the decoded node data into the static HTML output.

This contract defines the **expected shape, field requirements, and validation rules** that `nodes.json` must satisfy for the build to succeed.

---

## File Location

```
src/data/nodes.json
```

---

## Top-Level Structure

```json
{
  "nodes": [ /* array of Node objects */ ]
}
```

The root object MUST contain a `nodes` array. An empty array is valid (the map renders with no markers).

---

## Node Object Schema

```ts
interface NodeInput {
  id:                string;   // REQUIRED
  name:              string;   // REQUIRED
  city:              string;   // REQUIRED
  country:           string;   // REQUIRED
  venue:             string;   // REQUIRED
  address?:          string;   // OPTIONAL
  date:              string;   // REQUIRED — format: "YYYY-MM-DD"
  plus_code:         string;   // REQUIRED — full global OLC format
  website:           string;   // REQUIRED — valid absolute URL
  description:       string;   // REQUIRED — non-empty
  long_description?: string;   // OPTIONAL
  organizer_email:   string;   // REQUIRED — valid email address
}
```

### Field Definitions

| Field | Required | Format | Notes |
|-------|----------|--------|-------|
| `id` | ✅ | URL-safe string | Unique identifier. Convention: `pcd-{city}-{year}`, e.g. `pcd-berlin-2026`. Used as ICS UID component and element key. |
| `name` | ✅ | Non-empty string | Display name, e.g. `"PCD @ Berlin"`. Rendered in popup heading, detail panel, node list, and calendar event title. |
| `city` | ✅ | Non-empty string | City of the event. Used in detail panel, node list, and maps fallback query. |
| `country` | ✅ | Non-empty string | Country of the event. Used in detail panel and node list. |
| `venue` | ✅ | Non-empty string | Venue name, e.g. `"Prachtsaal"`. Used in popup and detail panel. |
| `address` | ❌ | String | Physical street address. **If absent**, the maps link uses `{venue}, {city}, {country}` as the search query. |
| `date` | ✅ | `"YYYY-MM-DD"` | ISO 8601 date. All events are all-day. Used for display formatting and calendar links. Example: `"2026-10-17"` |
| `plus_code` | ✅ | Full global OLC | Must be a **full global Open Location Code** — 8 or more characters before the `+`, no space, no city suffix. Example: `"9F4MGCFM+PF"`. **Build fails immediately** if this constraint is violated. |
| `website` | ✅ | Absolute URL | Event website. Must include scheme (`https://`). |
| `description` | ✅ | Non-empty string | Short description (~1–3 sentences). Used in popup and as calendar event description. |
| `long_description` | ❌ | String | Full event description. If absent, the detail panel uses `description` instead. May contain paragraph breaks (`\n\n`). |
| `organizer_email` | ✅ | Email address | Organizer contact. Rendered as a `mailto:` link. |

---

## Validation Enforced by the Build

The `loadNodes()` function in `src/lib/nodes.ts` enforces one validation rule at build time:

### Rule V-001: Plus Code Must Be Full Global Format

```
Condition: OpenLocationCode.isValid(plus_code) && OpenLocationCode.isFull(plus_code)
```

**If violated**: The build **throws** with:
```
Error: [nodes] Invalid or short plus_code for "{id}": "{plus_code}".
All plus codes must be full global codes. Look up the full code at https://plus.codes
```

**Full global code**: Contains 8 or more characters before the `+` and no space. Examples:
- ✅ Valid: `9F4MGCFM+PF`, `8FW4V75V+8Q`
- ❌ Invalid (short): `FCCM+PF Berlin`, `V75V+8Q`
- ❌ Invalid (malformed): `""`, `null`, arbitrary string

No other build-time validation is performed on `nodes.json`. Field presence and format are enforced by the upstream data pipeline.

---

## Validation NOT Enforced by the Build

The following are out of scope for the website build — enforced by the upstream pipeline:

- Email format of `organizer_email`
- URL format of `website`
- Presence of required fields (`id`, `name`, `city`, etc.)
- Date format of `date`
- Uniqueness of `id` across nodes

---

## Example `nodes.json`

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
      "long_description": "Join us for a full day of talks, workshops, and demos...",
      "organizer_email": "organizer@creativecode.berlin"
    },
    {
      "id": "pcd-tokyo-2026",
      "name": "PCD @ Tokyo",
      "city": "Tokyo",
      "country": "Japan",
      "venue": "Shibuya Stream Hall",
      "date": "2026-10-10",
      "plus_code": "8Q7XJQGW+P3",
      "website": "https://pcd.tokyo",
      "description": "Tokyo's annual creative coding gathering.",
      "organizer_email": "hello@pcd.tokyo"
    }
  ]
}
```

Note: The second node has no `address` or `long_description` — both are optional.

---

## Empty Nodes Case

```json
{ "nodes": [] }
```

Valid. The build succeeds. The map renders with no markers. No error is thrown.

---

## Computed Fields (Added by Build)

The `loadNodes()` function adds two fields to each Node before passing it to components:

| Field | Computed From | Value |
|-------|---------------|-------|
| `lat` | `plus_code` → `OpenLocationCode.decode(plus_code).latitudeCenter` | Latitude of node center |
| `lng` | `plus_code` → `OpenLocationCode.decode(plus_code).longitudeCenter` | Longitude of node center |

These fields are present on all `Node` objects in the application but absent from `nodes.json`.
