import { ref } from 'vue';
import { safeStorage } from '../lib/safeStorage.mjs';

export const SUPPORTED_LOCALES = ['en', 'es', 'de', 'fr', 'pt', 'zh-TW', 'zh-CN', 'ja', 'ko'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

const STORAGE_KEY = 'pcd-locale';

function detectLocale(): SupportedLocale {
  const stored = safeStorage.get(STORAGE_KEY) as SupportedLocale | null;
  if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;

  const browser = typeof navigator === 'undefined' ? '' : navigator.language || '';
  if (!browser) return 'en';

  // Handle Chinese variants explicitly before generic matching
  if (/^zh-(TW|HK|Hant)/i.test(browser)) return 'zh-TW';
  if (/^zh/i.test(browser)) return 'zh-CN';

  // Exact match (e.g. "zh-TW", "ko", "ja")
  if (SUPPORTED_LOCALES.includes(browser as SupportedLocale)) {
    return browser as SupportedLocale;
  }

  // Language-only match (e.g. "en-GB" → "en", "pt-BR" → "pt")
  const langOnly = browser.split('-')[0] as SupportedLocale;
  if (SUPPORTED_LOCALES.includes(langOnly)) return langOnly;

  return 'en';
}

export const currentLocale = ref<SupportedLocale>('en');

export function initLocale(): void {
  currentLocale.value = detectLocale();
}

export function setLocale(locale: SupportedLocale): void {
  currentLocale.value = locale;
  // Persistence is best-effort; the reactive locale still works this session.
  safeStorage.set(STORAGE_KEY, locale);
}
