import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIssueSections,
  isValidDate,
  isValidTime,
  isValidEmail,
  isValidHttpUrl,
  slugify,
  parseActivities,
  parseOrganizers,
  generateUniqueUid,
} from './event-issue-helpers.mjs';

// ── parseIssueSections ────────────────────────────────────────────────────────

describe('parseIssueSections', () => {
  test('parses normal sections', () => {
    const body = '### Event name\nPCD @ Berlin\n\n### City or locality\nBerlin\n';
    const fields = parseIssueSections(body);
    assert.equal(fields.get('Event name'), 'PCD @ Berlin');
    assert.equal(fields.get('City or locality'), 'Berlin');
  });

  test('cleans _No response_ values', () => {
    const body = '### City or locality\n_No response_\n';
    const fields = parseIssueSections(body);
    assert.equal(fields.get('City or locality'), '');
  });

  test('returns empty map for empty body', () => {
    const fields = parseIssueSections('');
    assert.equal(fields.size, 0);
  });

  test('normalizes \\r\\n line endings', () => {
    const body = '### Event name\r\nPCD @ Test\r\n';
    const fields = parseIssueSections(body);
    assert.equal(fields.get('Event name'), 'PCD @ Test');
  });
});

// ── isValidDate ───────────────────────────────────────────────────────────────

describe('isValidDate', () => {
  test('valid date', () => assert.equal(isValidDate('2026-10-17'), true));
  test('invalid format - missing leading zero', () => assert.equal(isValidDate('2026-1-17'), false));
  test('invalid format - not ISO', () => assert.equal(isValidDate('17/10/2026'), false));
  test('out-of-range month', () => assert.equal(isValidDate('2026-13-01'), false));
  test('out-of-range day', () => assert.equal(isValidDate('2026-01-32'), false));
  test('empty string', () => assert.equal(isValidDate(''), false));
});

// ── isValidTime ───────────────────────────────────────────────────────────────

describe('isValidTime', () => {
  test('valid time', () => assert.equal(isValidTime('14:30'), true));
  test('midnight', () => assert.equal(isValidTime('00:00'), true));
  test('hour 25 is invalid', () => assert.equal(isValidTime('25:00'), false));
  test('bad format - missing colon', () => assert.equal(isValidTime('1430'), false));
  test('minute 60 is invalid', () => assert.equal(isValidTime('14:60'), false));
});

// ── isValidEmail ──────────────────────────────────────────────────────────────

describe('isValidEmail', () => {
  test('valid email', () => assert.equal(isValidEmail('hello@example.com'), true));
  test('missing @', () => assert.equal(isValidEmail('helloexample.com'), false));
  test('missing TLD', () => assert.equal(isValidEmail('hello@example'), false));
  test('empty string', () => assert.equal(isValidEmail(''), false));
});

// ── isValidHttpUrl ────────────────────────────────────────────────────────────

describe('isValidHttpUrl', () => {
  test('http URL', () => assert.equal(isValidHttpUrl('http://example.com'), true));
  test('https URL', () => assert.equal(isValidHttpUrl('https://example.com/path'), true));
  test('ftp rejected', () => assert.equal(isValidHttpUrl('ftp://example.com'), false));
  test('non-URL string', () => assert.equal(isValidHttpUrl('not a url'), false));
  test('empty string', () => assert.equal(isValidHttpUrl(''), false));
});

// ── slugify ───────────────────────────────────────────────────────────────────

describe('slugify', () => {
  test('removes accents', () => assert.equal(slugify('São Paulo'), 'sao-paulo'));
  test('lowercases and replaces spaces', () => assert.equal(slugify('PCD @ Berlin'), 'pcd-berlin'));
  test('strips leading and trailing dashes', () => assert.equal(slugify('--hello--'), 'hello'));
  test('collapses multiple dashes', () => assert.equal(slugify('a  b   c'), 'a-b-c'));
  test('removes special chars', () => assert.equal(slugify('hello! world?'), 'hello-world'));
});

// ── parseActivities ───────────────────────────────────────────────────────────

describe('parseActivities', () => {
  test('returns checked activities', () => {
    const raw = '- [x] Show-and-tell\n- [ ] Exhibition\n- [x] Live coding\n';
    assert.deepEqual(parseActivities(raw), ['Show-and-tell', 'Live coding']);
  });

  test('returns empty for all unchecked', () => {
    const raw = '- [ ] Show-and-tell\n- [ ] Exhibition\n';
    assert.deepEqual(parseActivities(raw), []);
  });

  test('ignores unknown activities', () => {
    const raw = '- [x] Unknown activity\n- [x] Live coding\n';
    assert.deepEqual(parseActivities(raw), ['Live coding']);
  });

  test('case-insensitive [X]', () => {
    const raw = '- [X] Show-and-tell\n';
    assert.deepEqual(parseActivities(raw), ['Show-and-tell']);
  });
});

// ── parseOrganizers ───────────────────────────────────────────────────────────

describe('parseOrganizers', () => {
  test('plain names', () => {
    assert.deepEqual(parseOrganizers('Jane Doe\nAlex Smith\n'), [
      { name: 'Jane Doe' },
      { name: 'Alex Smith' },
    ]);
  });

  test('strips email suffix', () => {
    assert.deepEqual(parseOrganizers('Jane Doe <jane@example.com>\n'), [
      { name: 'Jane Doe' },
    ]);
  });

  test('blank lines are ignored', () => {
    assert.deepEqual(parseOrganizers('Jane Doe\n\n\nAlex Smith\n'), [
      { name: 'Jane Doe' },
      { name: 'Alex Smith' },
    ]);
  });

  test('returns empty array for empty input', () => {
    assert.deepEqual(parseOrganizers(''), []);
  });
});

// ── generateUniqueUid ─────────────────────────────────────────────────────────

describe('generateUniqueUid', () => {
  test('generates a 7-char string', () => {
    const uid = generateUniqueUid(new Set());
    assert.equal(uid.length, 7);
  });

  test('generates only hex chars', () => {
    const uid = generateUniqueUid(new Set());
    assert.match(uid, /^[0-9a-f]{7}$/);
  });

  test('does not collide with existing uids', () => {
    const existing = new Set(['abc1234', 'def5678']);
    const uid = generateUniqueUid(existing);
    assert.equal(existing.has(uid), true); // was added
    assert.notEqual(uid, 'abc1234');
    assert.notEqual(uid, 'def5678');
  });

  test('adds generated uid to the set', () => {
    const existing = new Set();
    const uid = generateUniqueUid(existing);
    assert.equal(existing.has(uid), true);
  });

  test('generates multiple unique uids in sequence', () => {
    const existing = new Set();
    const uids = new Set();
    for (let i = 0; i < 20; i++) {
      uids.add(generateUniqueUid(existing));
    }
    assert.equal(uids.size, 20);
  });
});
