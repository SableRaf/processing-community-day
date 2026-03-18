<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import { PCD_FORUM_THREAD_URL } from '../config';
import bannerImage from '../images/community_background_2x.png?url';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

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
          onDeactivate: () => emit('close'),
          escapeDeactivates: true,
          allowOutsideClick: true,
          fallbackFocus: () => modalRef.value!,
        });
        trap.activate();
      }
    } else {
      trap?.deactivate();
      trap = null;
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
      @click.self="emit('close')"
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
          :aria-label="t('nav.info_modal_close')"
          @click="emit('close')"
        >
          <Icon icon="bi:x-lg" width="1.125em" height="1.125em" aria-hidden="true" />
        </button>
        <img
          :src="bannerImage"
          class="info-modal-banner"
          alt=""
          aria-hidden="true"
        />
        <div class="info-modal-body">
          <h2 class="info-modal-title">{{ t('nav.info_modal_title') }}</h2>
          <p class="info-modal-description">{{ t('nav.info_modal_description') }}</p>
          <a
            :href="PCD_FORUM_THREAD_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="info-modal-forum-btn"
            :aria-label="t('nav.info_modal_forum_btn_new_tab')"
          >
            {{ t('nav.info_modal_forum_btn') }}
            <Icon icon="bi:box-arrow-up-right" width="1em" height="1em" aria-hidden="true" style="margin-left: 0.5rem; vertical-align: -0.1em;" />
          </a>
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
  margin: 0 0 var(--spacing-sm);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.info-modal-description {
  margin: 0 0 var(--spacing-lg);
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

.info-modal-forum-btn {
  display: block;
  width: 100%;
  padding: 0.625rem 1rem;
  background: var(--color-primary);
  color: #fff;
  text-align: center;
  text-decoration: none;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: 6px;
  box-sizing: border-box;
  transition: opacity 0.15s ease;
}

.info-modal-forum-btn:hover {
  opacity: 0.85;
}
</style>
