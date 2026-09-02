import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertIdentity, assertUniqueIds, parseZineMetadata, resolveZineAssets, zineMetadataSchema } from '../../pcd-website/src/lib/zine-metadata.js';

const valid = () => ({
  id: 'loops-with-shapes', title: 'Loops with Shapes', topic: 'Loops', created_by: 'Guide Author', summary: 'Make patterns with repeated shapes.',
  cover: { src: 'cover.png', alt: 'Loops with Shapes zine cover' },
  downloads: [{ file: 'guide.pdf', file_size: '24 kB', role: 'reader-order' }, { file: 'data.json', file_size: '1 kB' }], license: 'CC BY-SA 4.0',
});

describe('zine metadata', () => {
  test('accepts local generic downloads and manually maintained external downloads', () => {
    assert.deepEqual(parseZineMetadata(valid(), 'loops-with-shapes'), valid());
    const external = { ...valid(), cover: undefined, downloads: [{ url: 'https://example.com/guide.pdf', filename: 'guide.pdf', file_size: '24 kB', role: 'print-ready' }] };
    assert.deepEqual(parseZineMetadata(external, 'loops-with-shapes'), external);
  });
  test('enforces strict metadata and safe filenames', () => {
    for (const input of [{ ...valid(), pdfs: [] }, { ...valid(), downloads: [] }, { ...valid(), downloads: [{ file: '../guide.pdf', file_size: '1 kB' }] }, { ...valid(), downloads: [{ file: 'guide.pdf', file_size: '1 kB', role: 'screen' }] }, { ...valid(), cover: { src: 'cover.PNG', alt: 'Cover' } }, { ...valid(), languages: [] }]) assert.throws(() => parseZineMetadata(input, 'loops-with-shapes'), /Invalid metadata/);
  });
  test('guards urls and draft values', () => {
    assert.equal(zineMetadataSchema.safeParse({ ...valid(), source_url: 'https://example.com' }).success, true);
    assert.equal(zineMetadataSchema.safeParse({ ...valid(), source_url: 'javascript:alert(1)' }).success, false);
    assert.throws(() => parseZineMetadata({ ...valid(), draft: true }, 'loops-with-shapes'), /zines-drafts/);
  });
  test('checks cover and downloads in their separate namespaces', () => {
    assert.deepEqual(resolveZineAssets('loops-with-shapes', valid(), ['cover.png', 'guide.pdf', 'data.json']), { cover: 'cover.png', downloads: ['guide.pdf', 'data.json'] });
    assert.throws(() => resolveZineAssets('loops-with-shapes', valid(), ['cover.png']), /guide.pdf/);
  });
  test('checks unique ids and identity', () => {
    assert.throws(() => assertUniqueIds([valid(), valid()]), /Duplicate zine id/);
    assert.doesNotThrow(() => assertIdentity({ slug: 'loops-with-shapes', frontmatterId: 'loops-with-shapes', metadataId: 'loops-with-shapes' }));
  });
});
