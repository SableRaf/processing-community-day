export const SUBMIT_EVENT_BUTTON_CLICK = 'Submit Event Button Click';
export const SUBMIT_STEP_1 = 'Submit Step 1: Introduce Yourself';
export const SUBMIT_STEP_2 = 'Submit Step 2: Create a Forum Topic';
export const SUBMIT_STEP_3 = 'Submit Step 3: Submit via GitHub';

export type AnalyticsEvent =
  | typeof SUBMIT_EVENT_BUTTON_CLICK
  | typeof SUBMIT_STEP_1
  | typeof SUBMIT_STEP_2
  | typeof SUBMIT_STEP_3;

export function trackEvent(name: AnalyticsEvent): void {
  if (typeof window !== 'undefined') {
    window.fathom?.trackEvent(name);
  }
}
