// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import rehypeTableWrapper from './src/lib/rehype-table-wrapper.mjs';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://day.processing.org',
  base: '/',
  integrations: [vue({ appEntrypoint: '/src/i18n/vuePlugin' })],
  markdown: {
    rehypePlugins: [rehypeTableWrapper],
  },
  vite: {
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
