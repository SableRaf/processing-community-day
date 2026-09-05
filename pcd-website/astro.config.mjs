// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import rehypeTableWrapper from './src/lib/rehype-table-wrapper.mjs';
import rehypeHeadingAnchors from './src/lib/rehype-heading-anchors.mjs';
import { readFileSync } from 'node:fs';

// `npm run host -- --https` sets these to a generated self-signed cert. Unset
// in every other case, so the dev server stays plain HTTP by default.
const httpsKey = process.env.PCD_HTTPS_KEY;
const httpsCert = process.env.PCD_HTTPS_CERT;
const https =
  httpsKey && httpsCert
    ? { key: readFileSync(httpsKey), cert: readFileSync(httpsCert) }
    : undefined;

// Match the fixed production Netlify proxy for runtime forum requests.
const forumProxy = {
  '^/api/pcd-forum$': {
    target: 'https://discourse.processing.org',
    changeOrigin: true,
    rewrite: () => '/tag/pcd/l/latest.json?order=activity',
  },
};

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://day.processing.org',
  base: '/',
  integrations: [vue({ appEntrypoint: '/src/i18n/vuePlugin' })],
  markdown: {
    rehypePlugins: [rehypeTableWrapper, rehypeHeadingAnchors],
  },
  vite: {
    server: { https, proxy: forumProxy },
    ssr: {
      // ShareMenu is server-rendered on content pages. Bundle vue-i18n so its
      // compile-time feature flags are resolved during Astro's SSR build.
      noExternal: ['vue-i18n'],
    },
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === 'CIRCULAR_DEPENDENCY') return;
          warn(warning);
        },
      },
    },
  },
});
