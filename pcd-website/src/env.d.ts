export {};

declare global {
  interface Window {
    fathom?: {
      trackEvent: (name: string, opts?: Record<string, unknown>) => void;
    };
  }
}
