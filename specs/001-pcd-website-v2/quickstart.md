# Quickstart: PCD Website v2.1

**Branch**: `001-pcd-website-v2` | **Date**: 2026-03-03

---

## Prerequisites

- **Node.js** 20+ (check with `node -v`)
- **npm** 10+ (bundled with Node 20)
- **Git** (to clone and branch)

---

## 1. Create the Astro Project

```bash
# From the repository root (pcd-website-mvp-2/)
npm create astro@latest pcd-website -- --template minimal --no-install --no-git
cd pcd-website

# Add Vue 3 integration
npx astro add vue --yes

# Install runtime dependencies
npm install leaflet leaflet.markercluster open-location-code focus-trap

# Install dev dependencies
npm install --save-dev @types/leaflet @types/leaflet.markercluster
```

> The project lives in a `pcd-website/` subdirectory. All source paths below are relative to `pcd-website/`.

---

## 2. Configure Astro

Edit `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';

export default defineConfig({
  output: 'static',
  site: 'https://<your-org>.github.io',  // replace with actual GitHub org/user
  base: '/pcd-website-mvp-2',            // replace with actual repo name; omit if deploying to root
  integrations: [vue()],
  vite: {
    build: {
      rollupOptions: {
        // Suppress known leaflet.markercluster circular dep warning
        onwarn(warning, warn) {
          if (warning.code === 'CIRCULAR_DEPENDENCY') return;
          warn(warning);
        },
      },
    },
  },
});
```

Edit `tsconfig.json` to enable strict mode:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

---

## 3. Copy Node Data

```bash
# From the pcd-website/ directory
mkdir -p src/data
cp ../../pcd-website-mvp/data/nodes.json src/data/nodes.json
```

> **Important**: Before running the build, verify that all `plus_code` values in `nodes.json` are full global codes (no spaces, no city suffixes). Any node with a short code (e.g. `"FCCM+PF Berlin"`) will cause the build to fail with a clear error message. Look up full codes at [plus.codes](https://plus.codes).

---

## 4. Create the File Structure

Create these files in order:

```
src/
├── pages/index.astro
├── components/MapView.vue
├── components/NodePanel.vue
├── components/NodeList.vue
├── lib/nodes.ts
├── lib/format.ts
├── lib/popup.ts
└── styles/global.css
```

See the PRD (`PRD.md` at repository root) for the full implementation of each file.

---

## 5. Run the Development Server

```bash
npm run dev
```

Opens at `http://localhost:4321` (default Astro dev port). The map should appear with node markers.

---

## 6. Build for Production

```bash
npm run build
```

Output is in `dist/`. The build will **fail with a descriptive error** if any node has an invalid or short plus code — this is intentional and required (FR-005).

Preview the production build locally:

```bash
npm run preview
```

---

## 7. Set Up GitHub Pages Deployment

### a. Create the workflow file

Create `.github/workflows/deploy.yml` at the **repository root** (not inside `pcd-website/`):

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
          cache-dependency-path: pcd-website/package-lock.json
      - name: Install dependencies
        run: npm ci
        working-directory: pcd-website
      - name: Build
        run: npm run build
        working-directory: pcd-website
      - uses: actions/upload-pages-artifact@v3
        with:
          path: pcd-website/dist

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

### b. Enable GitHub Pages in repository settings

1. Go to **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. Save

Push to `main` to trigger the first deployment.

---

## 8. Verify the Deployment Checklist

After the first successful build and deploy, verify against the Definition of Done:

- [ ] `npm run build` succeeds with zero errors and zero warnings
- [ ] Build fails with clear error when a node has an invalid/short plus code
- [ ] Map loads with monochrome light styling (light grey land, grey water, no POIs)
- [ ] All nodes from `nodes.json` appear as red circle SVG markers
- [ ] Markers cluster at low zoom with styled red cluster icons
- [ ] Clicking a marker opens popup with name, date, venue, description, links
- [ ] "Read more" opens NodePanel with full details and working calendar links
- [ ] Google Maps link falls back gracefully when `address` is missing
- [ ] Burger menu opens NodeList; clicking a node flies the map and opens popup
- [ ] Escape key closes NodePanel and NodeList
- [ ] `M` key toggles NodeList (when map is focused)
- [ ] NodePanel and NodeList are mutually exclusive
- [ ] NodePanel and NodeList trap focus and return focus on close
- [ ] All interactive elements reachable via keyboard only
- [ ] Skip link present and functional
- [ ] Mobile (≤ 720px): NodePanel full-width, NodeList full-screen
- [ ] No API keys in codebase or deployment environment
- [ ] Site deploys and loads correctly on GitHub Pages

---

## Troubleshooting

### `window is not defined` during build

Leaflet is being imported outside `client:only`. Ensure `MapView.vue` is used with `client:only="vue"` in `index.astro`, and that `leaflet` is not imported in any Astro file or server-side module.

### Map tiles not rendering / controls unstyled

Leaflet CSS is missing. Ensure `leaflet.css`, `MarkerCluster.css`, and `MarkerCluster.Default.css` are loaded via `<link>` tags in `index.astro` `<head>`, not via JS imports.

### Build fails: `Invalid or short plus_code`

One or more nodes in `nodes.json` have a short plus code. Look up the full global code at [plus.codes](https://plus.codes) or Google Maps (right-click → "What's here?").

### `OpenLocationCode.isValid is not a function`

The installed version of `open-location-code` exports a class, not static methods. Adjust `nodes.ts`:
```ts
const olc = new (require('open-location-code'))();
olc.isValid(code); olc.isFull(code); olc.decode(code);
```
Or check `typeof OpenLocationCode.isValid` after import to detect which API is available.

### `Property 'markerClusterGroup' does not exist`

Missing `@types/leaflet.markercluster`. Run:
```bash
npm install --save-dev @types/leaflet.markercluster
```

### GitHub Pages: blank page or 404 on assets

The `base` in `astro.config.mjs` doesn't match your repository name. Ensure `base: '/your-repo-name'` matches exactly. Check that GitHub Pages is set to "GitHub Actions" source (not "Deploy from a branch").

### Focus trap error: `Your focus-trap must have at least one focusable element`

The panel or list DOM element is not yet mounted when `createFocusTrap()` is called. Ensure `createFocusTrap()` is called inside `onMounted()` after the template ref is available. Add `checkCanFocusTrap` or `fallbackFocus` option as safety net:
```ts
createFocusTrap(element, {
  fallbackFocus: element, // focus the container itself if no focusable children
});
```
