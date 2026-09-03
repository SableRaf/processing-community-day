import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { safeStorage } from '../../pcd-website/src/lib/safeStorage.mjs';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else delete globalThis.window;
});

test('returns safe defaults when the localStorage property lookup throws', () => {
  const blockedWindow = {};
  Object.defineProperty(blockedWindow, 'localStorage', {
    get() {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: blockedWindow,
  });

  assert.equal(safeStorage.get('key'), null);
  assert.equal(safeStorage.set('key', 'value'), false);
});

test('passes reads and writes through when localStorage is available', () => {
  const values = new Map([['existing', 'stored value']]);
  const localStorage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage },
  });

  assert.equal(safeStorage.get('existing'), 'stored value');
  assert.equal(safeStorage.get('missing'), null);
  assert.equal(safeStorage.set('new key', 'new value'), true);
  assert.equal(values.get('new key'), 'new value');
});
