import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertIdentity, assertUniqueIds, parseZineMetadata,
  resolveZineAssets, zineMetadataSchema,
} from '../../pcd-website/src/lib/zine-metadata.js';

const valid = () => ({
  id: 'loops-with-shapes', title: 'Loops with Shapes', topic: 'Loops',
  created_by: 'Guide Author', summary: 'Make patterns with repeated shapes.',
  cover: 'cover.png', pdfs: [{ file: 'guide.pdf', label: 'Read on screen', file_size: '24 kB' }],
  license: 'CC BY-SA 4.0',
});

describe('zine metadata', () => {
  test('accepts valid metadata', () => {
    assert.deepEqual(parseZineMetadata(valid(), 'loops-with-shapes'), valid());
    const withoutCover = { ...valid(), cover: undefined };
    assert.deepEqual(parseZineMetadata(withoutCover, 'loops-with-shapes'), withoutCover);
    const externalPdf = {
      ...valid(), cover: undefined, license: undefined,
      pdfs: [{
        url: 'https://example.com/guide.pdf', label: 'Download guide',
        filename: 'guide.pdf', file_size: '24 kB',
      }],
    };
    assert.deepEqual(parseZineMetadata(externalPdf, 'loops-with-shapes'), externalPdf);
  });

  test('rejects non-object metadata cleanly', () => {
    for (const input of [null, 'metadata', []]) {
      assert.throws(() => parseZineMetadata(input, 'loops-with-shapes'), /Invalid metadata/);
    }
  });

  test('validates required values, topics, ids, and strict object keys', () => {
    const cases = [
      [{ ...valid(), topic: '   ' }, /topic/],
      [{ ...valid(), title: '   ' }, /title/],
      [{ ...valid(), id: 'Not Kebab' }, /id/],
      [{ ...valid(), unexpected: true }, /Unrecognized key/],
      [{ ...valid(), cover: 'cover.PNG' }, /cover/],
      [{ ...valid(), pdfs: [] }, /pdfs/],
      [{ ...valid(), pdfs: [{ file: 'guide.PDF', label: 'PDF', file_size: '24 kB' }] }, /pdfs/],
      [{ ...valid(), pdfs: [{ file: 'guide.txt', label: 'Text', file_size: '24 kB' }] }, /pdfs/],
      [{ ...valid(), pdfs: [{ file: 'guide.pdf', file_size: '24 kB' }] }, /pdfs/],
      [{ ...valid(), pdfs: [{ file: 'guide.pdf', label: 'PDF' }] }, /pdfs/],
      [{ ...valid(), pdfs: [{ file: 'guide.pdf', label: 'PDF', file_size: '24 kB', extra: true }] }, /Unrecognized key/],
      [{ ...valid(), pdfs: [{
        url: 'javascript:alert(1)', label: 'PDF', filename: 'guide.pdf', file_size: '24 kB',
      }] }, /pdfs/],
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
    assert.deepEqual(resolveZineAssets('loops-with-shapes', {
      ...valid(), cover: undefined,
      pdfs: [{
        url: 'https://example.com/guide.pdf', label: 'Download guide',
        filename: 'guide.pdf', file_size: '24 kB',
      }],
    }, []), { cover: undefined, pdfs: [] });
    assert.throws(() => resolveZineAssets('loops-with-shapes', valid(), ['cover.png']), /guide.pdf/);
    assert.throws(() => resolveZineAssets('loops-with-shapes', valid(), ['guide.pdf']), /cover.png/);
  });

  test('checks unique ids and three-way identity', () => {
    const first = valid();
    assert.throws(() => assertUniqueIds([first, { ...valid() }]), /Duplicate zine id/);
    assert.throws(() => assertIdentity({ slug: 'loops-with-shapes', frontmatterId: 'loops', metadataId: 'loops-with-shapes' }), /identity mismatch/);
    assert.doesNotThrow(() => assertIdentity({ slug: 'loops-with-shapes', frontmatterId: 'loops-with-shapes', metadataId: 'loops-with-shapes' }));
  });
});
