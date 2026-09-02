import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedRedirectHost, fetchAttachment, formatFileSize, hasValidContent, isGitHubAttachmentUrl,
  normaliseFilename, parseSubmittedAttachments, validateAttachmentSelection, validateDownloadedFiles,
} from './zine-intake-helpers.mjs';

const attachment = (name, url = `https://github.com/user-attachments/files/1/${name}`) => `[${name}](${url})`;
const bytes = (...values) => new Uint8Array(values);

describe('new-zine attachment intake', () => {
  test('accepts only direct GitHub attachments and preserves names with lowercase extensions', () => {
    assert.equal(isGitHubAttachmentUrl('https://github.com/user-attachments/files/1/a.pdf'), true);
    assert.equal(isGitHubAttachmentUrl('https://example.com/a.pdf'), false);
    const uploaded = '[My Guide.PDF](https://github.com/user-attachments/files/1/my-guide.pdf)';
    assert.deepEqual(parseSubmittedAttachments(`${uploaded}\n${uploaded}`), { attachments: [{ filename: 'My Guide.PDF', url: 'https://github.com/user-attachments/files/1/my-guide.pdf' }], invalidEntries: [] });
    assert.equal(normaliseFilename('My Guide.PDF'), 'My Guide.pdf');
    assert.equal(normaliseFilename('../secret.pdf'), null);
    assert.equal(normaliseFilename('metadata.json'), null);
    assert.equal(normaliseFilename('bad\u0000.pdf'), null);
  });
  test('gives actionable errors for external URLs, collisions, formats, and aggregate file count', () => {
    const external = parseSubmittedAttachments('[guide.pdf](https://example.com/guide.pdf)');
    assert.equal(external.invalidEntries.length, 1);
    const files = Array.from({ length: 11 }, (_, index) => ({ filename: index === 1 ? 'SAME.pdf' : index === 0 ? 'same.pdf' : `file-${index}.exe`, field: 'Additional files', kind: 'download' }));
    const messages = validateAttachmentSelection(files).map((error) => error.message).join(' ');
    assert.match(messages, /no more than 10/); assert.match(messages, /unique/); assert.match(messages, /Supported downloads/);
  });
  test('checks binary signatures and UTF-8/JSON content independently of MIME', () => {
    assert.equal(hasValidContent('guide.pdf', new TextEncoder().encode('%PDF-1.7')), true);
    assert.equal(hasValidContent('archive.zip', bytes(0x50, 0x4b, 0x03, 0x04)), true);
    assert.equal(hasValidContent('cover.png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), true);
    assert.equal(hasValidContent('cover.jpg', bytes(0xff, 0xd8, 0xff)), true);
    assert.equal(hasValidContent('cover.webp', new TextEncoder().encode('RIFFxxxxWEBP')), true);
    assert.equal(hasValidContent('notes.txt', new TextEncoder().encode('hello')), true);
    assert.equal(hasValidContent('data.json', new TextEncoder().encode('{"ok":true}')), true);
    assert.equal(hasValidContent('data.json', new TextEncoder().encode('{bad')), false);
    assert.equal(hasValidContent('notes.txt', bytes(0x68, 0x00)), false);
  });
  test('uses decimal file sizes and field-specific limits, including cover guidance', () => {
    assert.equal(formatFileSize(311_000), '311 kB'); assert.equal(formatFileSize(1_200_000), '1.2 MB');
    const tooLargeCover = { filename: 'cover.png', field: 'Cover image', kind: 'cover', bytes: new Uint8Array(10_000_001) };
    const errors = validateDownloadedFiles([tooLargeCover]);
    assert.match(errors.map((error) => error.message).join(' '), /Resize or compress the cover/);
  });
  test('follows only approved HTTPS redirects and stops after five hops', async () => {
    assert.equal(allowedRedirectHost('objects.githubusercontent.com'), true);
    assert.equal(allowedRedirectHost('evil.example'), false);
    let calls = 0;
    const fetchMock = async () => {
      calls += 1;
      return calls === 1 ? new Response(null, { status: 302, headers: { location: 'https://objects.githubusercontent.com/file' } }) : new Response(bytes(0x25, 0x50, 0x44, 0x46, 0x2d), { status: 200 });
    };
    assert.deepEqual(await fetchAttachment('https://github.com/user-attachments/files/1/guide.pdf', fetchMock), bytes(0x25, 0x50, 0x44, 0x46, 0x2d));
    await assert.rejects(fetchAttachment('https://example.com/guide.pdf', fetchMock), /direct GitHub file attachments/);
    await assert.rejects(fetchAttachment('https://github.com/user-attachments/files/1/guide.pdf', async () => new Response(null, { status: 302, headers: { location: 'https://evil.example/file' } })), /unapproved host/);
  });
});
