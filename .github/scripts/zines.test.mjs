import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertIdentity, assertUniqueIds, assertUniqueTopics, parseZineMetadata,
  resolveZineAssets, zineMetadataSchema,
} from '../../pcd-website/src/lib/zine-metadata.js';

const valid = () => ({
  id: 'loops-with-shapes', title: 'Loops with Shapes', topic: 'Loops',
  created_by: 'Guide Author', summary: 'Make patterns with repeated shapes.',
  cover: 'cover.png', pdfs: [{ file: 'guide.pdf', label: 'Read on screen' }],
  license: 'CC BY-SA 4.0',
});

describe('zine metadata', () => {
  test('accepts valid metadata', () => {
    assert.deepEqual(parseZineMetadata(valid(), 'loops-with-shapes'), valid());
  });

  test('rejects non-object metadata cleanly', () => {
    for (const input of [null, 'metadata', []]) {
      assert.throws(() => parseZineMetadata(input, 'loops-with-shapes'), /Invalid metadata/);
    }
  });

  test('validates required values, topics, ids, and strict object keys', () => {
    const cases = [
      [{ ...valid(), topic: 'Physics' }, /topic/],
      [{ ...valid(), title: '   ' }, /title/],
      [{ ...valid(), id: 'Not Kebab' }, /id/],
      [{ ...valid(), unexpected: true }, /Unrecognized key/],
      [{ ...valid(), cover: undefined }, /cover/],
      [{ ...valid(), cover: 'cover.PNG' }, /cover/],
      [{ ...valid(), pdfs: [] }, /pdfs/],
      [{ ...valid(), pdfs: [{ file: 'guide.PDF', label: 'PDF' }] }, /pdfs/],
      [{ ...valid(), pdfs: [{ file: 'guide.txt', label: 'Text' }] }, /pdfs/],
      [{ ...valid(), pdfs: [{ file: 'guide.pdf' }] }, /pdfs/],
      [{ ...valid(), pdfs: [{ file: 'guide.pdf', label: 'PDF', extra: true }] }, /Unrecognized key/],
      [{ ...valid(), license: 'CC BY 4.0' }, /license/],
    ];
    for (const [input, message] of cases) {
      assert.throws(() => parseZineMetadata(input, 'loops-with-shapes'), message);
    }
  });

  test('rejects draft zines with the safe unpublished location', () => {
    assert.throws(() => parseZineMetadata({ ...valid(), draft: true }, 'loops-with-shapes'), /zines-drafts/);
  });

  test('guards source URLs without allowing malformed values to escape', () => {
    for (const source_url of ['https://example.com', 'http://example.com/path']) {
      assert.equal(zineMetadataSchema.safeParse({ ...valid(), source_url }).success, true);
    }
    for (const source_url of ['javascript:alert(1)', 'data:text/html,test', 'not a url']) {
      assert.doesNotThrow(() => zineMetadataSchema.safeParse({ ...valid(), source_url }));
      assert.equal(zineMetadataSchema.safeParse({ ...valid(), source_url }).success, false);
    }
  });

  test('checks asset existence', () => {
    assert.deepEqual(resolveZineAssets('loops-with-shapes', valid(), ['cover.png', 'guide.pdf']), {
      cover: 'cover.png', pdfs: ['guide.pdf'],
    });
    assert.throws(() => resolveZineAssets('loops-with-shapes', valid(), ['cover.png']), /guide.pdf/);
    assert.throws(() => resolveZineAssets('loops-with-shapes', valid(), ['guide.pdf']), /cover.png/);
  });

  test('checks unique topics, unique ids, and three-way identity', () => {
    const first = valid();
    const sameTopic = { ...valid(), id: 'other-loops' };
    assert.throws(() => assertUniqueTopics([first, sameTopic]), /both claim/);
    assert.throws(() => assertUniqueIds([first, { ...valid() }]), /Duplicate zine id/);
    assert.throws(() => assertIdentity({ slug: 'loops-with-shapes', frontmatterId: 'loops', metadataId: 'loops-with-shapes' }), /identity mismatch/);
    assert.doesNotThrow(() => assertIdentity({ slug: 'loops-with-shapes', frontmatterId: 'loops-with-shapes', metadataId: 'loops-with-shapes' }));
  });
});
