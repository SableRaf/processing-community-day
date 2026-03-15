<template>
  <div class="lang-switcher" ref="wrapRef" @keydown.escape="closeAndRefocus">
    <button
      ref="btnRef"
      class="lang-btn"
      :aria-label="t('language_switcher.label')"
      :title="t('language_switcher.label')"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click.stop="open = !open"
    >
      <Icon icon="bi:globe" width="1em" height="1em" aria-hidden="true" />
      <span class="lang-current">{{ currentLocale.toUpperCase() }}</span>
      <Icon icon="bi:chevron-down" class="lang-chevron" :class="{ 'lang-chevron--open': open }" width="0.75em" height="0.75em" aria-hidden="true" />
    </button>
    <ul
      v-show="open"
      :inert="!open"
      role="listbox"
      :aria-label="t('language_switcher.label')"
      class="lang-dropdown"
    >
      <li
        v-for="locale in SUPPORTED_LOCALES"
        :key="locale"
        role="option"
        :aria-selected="locale === currentLocale"
        class="lang-option"
        :class="{ 'lang-option--active': locale === currentLocale }"
        tabindex="0"
        @click="select(locale)"
        @keydown.enter.prevent="select(locale)"
        @keydown.space.prevent="select(locale)"
      >
        {{ LANGUAGE_NAMES[locale] }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { SUPPORTED_LOCALES, type SupportedLocale } from '../i18n/index';
import { currentLocale, setLocale } from '../i18n/localeState';

const { t } = useI18n();
const open = ref(false);
const wrapRef = ref<HTMLElement | null>(null);
const btnRef = ref<HTMLButtonElement | null>(null);

const LANGUAGE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  pt: 'Português',
  'zh-TW': '正體中文', // Traditional Chinese
  'zh-CN': '简体中文', // Simplified Chinese
  ja: '日本語',
  ko: '한국어',
};

function select(locale: SupportedLocale) {
  setLocale(locale);
  open.value = false;
}

function closeAndRefocus() {
  open.value = false;
  btnRef.value?.focus();
}

function handleOutsideClick(e: MouseEvent) {
  if (open.value && !wrapRef.value?.contains(e.target as Node)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener('click', handleOutsideClick));
onUnmounted(() => document.removeEventListener('click', handleOutsideClick));
</script>

<style scoped>
.lang-switcher {
  position: relative;
}

.lang-btn {
  display: flex;
  align-items: center;
  gap: 0.3em;
  height: 40px;
  padding: 0 0.625rem;
  background: var(--color-bg-popup);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-text);
  font-family: var(--font-family);
  font-size: 0.8125rem;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
  white-space: nowrap;
}

.lang-btn:hover {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.lang-btn:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.lang-current {
  font-size: 0.75rem;
  letter-spacing: 0.03em;
}

.lang-chevron {
  transition: transform 0.15s ease;
  opacity: 0.7;
}

.lang-chevron--open {
  transform: rotate(180deg);
}

.lang-dropdown {
  position: absolute;
  left: 0;
  top: calc(100% + 4px);
  list-style: none;
  margin: 0;
  padding: 4px;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 160px;
  max-height: 320px;
  overflow-y: auto;
}

.lang-option {
  padding: 8px 12px;
  font-size: 0.875rem;
  cursor: pointer;
  border-radius: 4px;
  color: var(--color-text);
  font-family: var(--font-family);
  list-style: none;
}

.lang-option:hover {
  background: var(--color-bg-popup-hover);
}

.lang-option--active {
  color: var(--color-link);
  font-weight: 600;
}

@media (max-width: 480px) {
  .lang-current {
    display: none;
  }

  .lang-chevron {
    display: none;
  }
}
</style>
