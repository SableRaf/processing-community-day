# PCD 2026 Website

A global map of [Processing Community Day](https://discourse.processing.org/t/pcd-worldwide-2026-call-for-organizers/48081) events for 2026.

This will grow into a full-featured PCD site with event details, organizer kit, guidelines, resources, and more, but for now it's a simple map-based directory of events.

## Adding an event

Open a GitHub Issue using the **New Event** template. The intake workflow validates the submission and opens a pull request with the generated event files. The PR must be reviewed and merged by a maintainer before the event appears on the map.

## Tech

- **[Astro 5](https://astro.build)** — static site generation; single entry point (`pcd-website/src/pages/index.astro`)
- **[Vue 3](https://vuejs.org)** — all interactive UI as client-only island components
- **[Leaflet](https://leafletjs.com)** 
- **[leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster)** — for clustering map markers
- **[Open Location Code](https://github.com/google/open-location-code)** — for geocoding plus codes to lat/lng
- **[GitHub Workflows](https://github.com/features/actions)** — for event submission, review, and data management

## Developing

```sh
cd pcd-website
npm install
npm run dev      # localhost:4321
npm run build    # production build → dist/
npm run preview  # preview production build
```