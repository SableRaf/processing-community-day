declare global {
  interface ImportMetaEnv {
    readonly PUBLIC_CARTO_API_KEY?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    fathom?: {
      trackEvent: (name: string, opts?: Record<string, unknown>) => void;
    };
  }
}

export {};
