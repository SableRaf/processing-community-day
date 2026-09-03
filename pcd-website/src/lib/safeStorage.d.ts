export const safeStorage: {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
};
