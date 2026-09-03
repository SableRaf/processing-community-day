<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { vTouchActivate } from '../directives/touchActivate';

const props = withDefaults(defineProps<{
  message: string;
  closeLabel: string;
  duration?: number;
}>(), {
  duration: 6000,
});

const emit = defineEmits<{ dismiss: [] }>();
const timerStyle = computed(() => ({ '--snackbar-duration': `${props.duration}ms` }));
let dismissTimer: number | undefined;

function dismiss() {
  window.clearTimeout(dismissTimer);
  emit('dismiss');
}

onMounted(() => {
  dismissTimer = window.setTimeout(dismiss, props.duration);
});

onBeforeUnmount(() => {
  window.clearTimeout(dismissTimer);
});
</script>

<template>
  <div
    class="snackbar"
    :style="timerStyle"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <span class="snackbar__message">{{ message }}</span>
    <button
      class="modal-close-button snackbar__close"
      type="button"
      :aria-label="closeLabel"
      @click="dismiss"
      v-touch-activate="dismiss"
    >
      <svg class="snackbar__timer" viewBox="0 0 36 36" aria-hidden="true">
        <circle class="snackbar__timer-track" cx="18" cy="18" r="16" pathLength="100" />
        <circle class="snackbar__timer-progress" cx="18" cy="18" r="16" pathLength="100" />
      </svg>
      <span aria-hidden="true">&times;</span>
    </button>
  </div>
</template>

<style scoped>
.snackbar {
  position: fixed;
  z-index: calc(var(--z-panel) + 100);
  right: var(--spacing-lg);
  bottom: max(var(--spacing-lg), env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  width: min(24rem, calc(100vw - (2 * var(--spacing-lg))));
  min-height: 3.25rem;
  padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) var(--spacing-md);
  color: var(--color-text);
  background: var(--color-bg-panel);
  border: 0;
  border-radius: 0.375rem;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.2);
}

.snackbar__message {
  flex: 1;
  min-width: 0;
  font-size: 0.875rem;
  line-height: 1.4;
}

.snackbar__close {
  flex: 0 0 auto;
  margin-left: var(--spacing-sm);
}

.snackbar__timer {
  position: absolute;
  inset: -0.125rem;
  width: 2.25rem;
  height: 2.25rem;
  pointer-events: none;
  fill: none;
  stroke-width: 1.5;
  transform: rotate(-90deg);
}

.snackbar__timer-track {
  stroke: var(--color-border);
}

.snackbar__timer-progress {
  stroke: var(--color-link);
  stroke-linecap: round;
  stroke-dasharray: 100;
  stroke-dashoffset: 0;
  animation: snackbar-countdown var(--snackbar-duration) linear forwards;
}

@keyframes snackbar-countdown {
  to {
    stroke-dashoffset: 100;
  }
}

@media (max-width: 47.999rem) {
  .snackbar {
    right: auto;
    left: 50%;
    width: min(28rem, calc(100vw - (2 * var(--spacing-md))));
    transform: translateX(-50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .snackbar__timer-progress {
    animation: none;
  }
}
</style>
