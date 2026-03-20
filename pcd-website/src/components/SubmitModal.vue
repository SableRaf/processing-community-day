<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { createFocusTrap, type FocusTrap } from 'focus-trap';
import { SUBMIT_EVENT_URL, PCD_FORUM_THREAD_URL, PCD_FORUM_NEW_TOPIC_URL } from '../config';
import { trackEvent, SUBMIT_STEP_1, SUBMIT_STEP_2, SUBMIT_STEP_3, type AnalyticsEvent } from '../lib/analytics';

function handleStepClick(event: AnalyticsEvent) {
  trackEvent(event);
}

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const modalRef = ref<HTMLElement | null>(null);
let trap: FocusTrap | null = null;
let closing = false;

function handleClose() {
  if (closing) return;
  closing = true;
  emit('close');
  setTimeout(() => {
    document.getElementById('host-btn')?.focus();
    closing = false;
  }, 0);
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      closing = false;
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
      class="submit-modal-backdrop"
      @click.self="handleClose()"
    >
      <div
        ref="modalRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-modal-title"
        class="submit-modal"
      >
        <button
          class="submit-modal-close"
          :aria-label="t('nav.submit_modal_close')"
          @click="handleClose()"
        >×</button>
        <div class="submit-modal-body">
          <h2 id="submit-modal-title" class="submit-modal-title">{{ t('nav.submit_modal_title') }}</h2>
          <ol class="submit-steps">
            <li class="submit-step">
              <span class="step-num" aria-hidden="true">1</span>
              <a
                class="step-btn"
                :href="PCD_FORUM_THREAD_URL"
                target="_blank"
                rel="noopener"
                @click="handleStepClick(SUBMIT_STEP_1)"
                :aria-label="`${t('nav.submit_modal_step1_heading')} — ${t('nav.submit_modal_step1_body')} (${t('nav.opens_in_new_tab')})`"
              >
                <span class="step-btn-text">
                  <strong>{{ t('nav.submit_modal_step1_heading') }}</strong>
                  <span class="step-btn-body">{{ t('nav.submit_modal_step1_body') }}</span>
                </span>
                <span class="step-btn-arrow" aria-hidden="true">→</span>
              </a>
            </li>
            <li class="submit-step">
              <span class="step-num" aria-hidden="true">2</span>
              <a
                class="step-btn"
                :href="PCD_FORUM_NEW_TOPIC_URL"
                target="_blank"
                rel="noopener"
                @click="handleStepClick(SUBMIT_STEP_2)"
                :aria-label="`${t('nav.submit_modal_step2_heading')} — ${t('nav.submit_modal_step2_body')} (${t('nav.opens_in_new_tab')})`"
              >
                <span class="step-btn-text">
                  <strong>{{ t('nav.submit_modal_step2_heading') }}</strong>
                  <span class="step-btn-body">{{ t('nav.submit_modal_step2_body') }}</span>
                </span>
                <span class="step-btn-arrow" aria-hidden="true">→</span>
              </a>
            </li>
            <li class="submit-step">
              <span class="step-num" aria-hidden="true">3</span>
              <a
                class="step-btn"
                :href="SUBMIT_EVENT_URL"
                target="_blank"
                rel="noopener"
                @click="handleStepClick(SUBMIT_STEP_3)"
                :aria-label="`${t('nav.submit_modal_step3_heading')} — ${t('nav.submit_modal_step3_body')} (${t('nav.opens_in_new_tab')})`"
              >
                <span class="step-btn-text">
                  <strong>{{ t('nav.submit_modal_step3_heading') }}</strong>
                  <span class="step-btn-body">{{ t('nav.submit_modal_step3_body') }}</span>
                </span>
                <span class="step-btn-arrow" aria-hidden="true">→</span>
              </a>
            </li>
          </ol>
          <p class="submit-modal-note">{{ t('nav.submit_modal_note') }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.submit-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: var(--z-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
}

.submit-modal {
  position: relative;
  background: var(--color-bg-panel);
  border-radius: 12px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.submit-modal-close {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  z-index: 1;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--color-text-muted);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.submit-modal-close:hover {
  background: var(--color-border);
  color: var(--color-text);
}

.submit-modal-close:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.submit-modal-body {
  padding: var(--spacing-lg);
  padding-top: calc(var(--spacing-lg) + 8px);
}

.submit-modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0 0 var(--spacing-lg);
  color: var(--color-text);
  padding-right: 2rem;
}

.submit-steps {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.submit-step {
  display: flex;
  gap: var(--spacing-sm);
  align-items: stretch;
}

.step-num {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.5rem;
}

.step-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0.625rem 0.75rem;
  background: var(--color-bg-secondary, color-mix(in srgb, var(--color-bg-panel) 94%, var(--color-text) 6%));
  border: 1px solid var(--color-border);
  border-radius: 8px;
  text-decoration: none;
  color: var(--color-text);
  transition: background-color 0.15s ease, border-color 0.15s ease;
  min-width: 0;
}

.step-btn:hover {
  background: color-mix(in srgb, var(--color-bg-panel) 88%, var(--color-primary) 12%);
  border-color: var(--color-primary);
}

.step-btn:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.step-btn-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.step-btn-text strong {
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.3;
}

.step-btn-body {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.step-btn-arrow {
  flex-shrink: 0;
  font-size: 1rem;
  color: var(--color-text-muted);
  transition: transform 0.15s ease, color 0.15s ease;
}

.step-btn:hover .step-btn-arrow {
  transform: translateX(3px);
  color: var(--color-primary);
}

.submit-modal-note {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border);
  padding-top: var(--spacing-md);
}
</style>
