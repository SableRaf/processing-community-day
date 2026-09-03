import type { ObjectDirective } from 'vue';

type TouchAction = () => void;

const listeners = new WeakMap<HTMLButtonElement, EventListener>();

/**
 * Runs a button action directly from touchend and suppresses WebKit's
 * unreliable synthesized click. Keep the button's normal click handler for
 * mouse, keyboard, and assistive-technology activation.
 */
export const vTouchActivate: ObjectDirective<HTMLButtonElement, TouchAction> = {
  mounted(element, binding) {
    const listener: EventListener = (event) => {
      if (element.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      binding.value();
    };

    listeners.set(element, listener);
    element.addEventListener('touchend', listener, { passive: false });
  },

  beforeUnmount(element) {
    const listener = listeners.get(element);
    if (!listener) return;
    element.removeEventListener('touchend', listener);
    listeners.delete(element);
  },
};
