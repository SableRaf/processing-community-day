// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import rehypeTableWrapper from './src/lib/rehype-table-wrapper.mjs';
import rehypeHeadingAnchors from './src/lib/rehype-heading-anchors.mjs';

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
