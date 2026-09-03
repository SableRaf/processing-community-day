import type { App } from 'vue';
import { i18n, syncLocale } from './index';

export default function setup(app: App): void {
  app.use(i18n);
  if (typeof window !== 'undefined') {
    try {
      syncLocale();
    } catch (error) {
      // @astrojs/vue awaits this entrypoint before app.mount(). Locale setup
      // must never leave server-rendered islands visible but unhydrated.
      console.warn('[i18n] Locale sync failed; falling back to English.', error);
    }
  }
}
