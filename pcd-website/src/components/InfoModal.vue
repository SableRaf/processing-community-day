<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import fallbackBannerImage from '../images/community_background_2x.png?url';

const props = defineProps<{ open: boolean; bannerImageUrl?: string; autoOpened?: boolean }>();
const bannerImage = computed(() => props.bannerImageUrl ?? fallbackBannerImage);
const emit = defineEmits<{ close: []; suppress: [] }>();

const dontShowAgain = ref(false);

function handleClose() {
  if (dontShowAgain.value) emit('suppress');
  else emit('close');
}

const { t } = useI18n();
const modalRef = ref<HTMLElement | null>(null);
let trap: FocusTrap | null = null;

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      if (modalRef.value) {
        trap = createFocusTrap(modalRef.value, {
          onDeactivate: () => handleClose(),
          escapeDeactivates: true,
          allowOutsideClick: true,
          fallbackFocus: () => modalRef.value!,
        });
        trap.activate();
      }
    } else {
      trap?.deactivate();
      trap = null;
      dontShowAgain.value = false;
    }
  },
);

onUnmounted(() => {
  trap?.deactivate();
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="info-modal-backdrop"
      @click.self="handleClose()"
    >
      <div
        ref="modalRef"
        role="dialog"
        aria-modal="true"
        :aria-label="t('nav.info_modal_title')"
        class="info-modal"
      >
        <button
          class="info-modal-close"
          :aria-label="t('nav.info_modal_back_to_map')"
          @click="handleClose()"
        >
          <Icon icon="bi:x-lg" width="1.125em" height="1.125em" aria-hidden="true" />
        </button>
        <img
          :src="bannerImage"
          class="info-modal-banner"
          alt="Processing Community Day 2026 banner with bold text and collage of community photos showing groups of people at events, alongside the Processing Foundation logo."
          loading="lazy"
        />
        <div class="info-modal-body">
          <h2 class="info-modal-title">{{ t('nav.info_modal_title') }}</h2>
          <p class="info-modal-description">{{ t('nav.info_modal_description') }}</p>
          <button
            class="info-modal-show-map-btn"
            @click="handleClose()"
          >
            {{ props.autoOpened ? t('nav.info_modal_go_to_map') : t('nav.info_modal_back_to_map') }}
          </button>
          <label v-if="props.autoOpened" class="info-modal-suppress">
            <input
              type="checkbox"
              v-model="dontShowAgain"
              @keydown.enter.prevent="dontShowAgain = !dontShowAgain"
            />
            {{ t('nav.info_modal_dont_show_again') }}
          </label>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.info-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: var(--z-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
}

.info-modal {
  position: relative;
  background: var(--color-bg-panel);
  border-radius: 12px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.info-modal-close {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  z-index: 1;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.info-modal-close:hover {
  background: rgba(0, 0, 0, 0.55);
}

.info-modal-close:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.info-modal-banner {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.info-modal-body {
  padding: var(--spacing-lg);
}

.info-modal-title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.info-modal-description {
  margin: 0 0 var(--spacing-lg);
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

.info-modal-show-map-btn {
  display: block;
  width: 100%;
  padding: 0.625rem 1rem;
  background: var(--color-primary);
  color: #fff;
  text-align: center;
  font-size: 0.9375rem;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  box-sizing: border-box;
  transition: opacity 0.15s ease;
}

.info-modal-show-map-btn:hover {
  opacity: 0.85;
}

.info-modal-show-map-btn:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.info-modal-suppress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: var(--spacing-md);
  font-size: 0.875rem;
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
}

.info-modal-suppress input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  flex-shrink: 0;
  accent-color: var(--color-primary);
}
</style>
