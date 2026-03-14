// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';

const isNetlify = process.env.DEPLOY_TARGET === 'netlify';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: isNetlify ? 'https://processing-community-day.netlify.app' : 'https://processing.github.io',
  base: isNetlify ? '/' : '/pcd-website-mvp-2',
  integrations: [vue()],
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
