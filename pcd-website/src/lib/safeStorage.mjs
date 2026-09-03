/**
 * Read and write localStorage without allowing browser privacy settings to
 * abort application startup. The property lookup itself can throw in Safari,
 * so it must remain inside each try block.
 */
export const safeStorage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
};
