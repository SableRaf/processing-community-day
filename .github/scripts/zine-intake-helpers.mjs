import { formatError } from './event-issue-helpers.mjs';

export const ZINE_TEMPLATE_HEADING = '### Reader-order PDF';
export const COVER_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);
export const DOWNLOAD_EXTENSIONS = new Set(['pdf', 'zip', 'png', 'jpg', 'jpeg', 'webp', 'txt', 'md', 'csv', 'json']);
export const MAX_FILES = 10;
export const MAX_IMAGE_BYTES = 10_000_000;
export const MAX_OTHER_BYTES = 25_000_000;
export const MAX_TOTAL_BYTES = 50_000_000;

const REDIRECT_HOSTS = [/^objects\.githubusercontent\.com$/i, /^github-cloud\.s3\.amazonaws\.com$/i, /^github-production-user-asset-[^.]+\.s3\.amazonaws\.com$/i, /^github-production-repository-file-[^.]+\.s3\.amazonaws\.com$/i];
const WINDOWS_RESERVED_BASENAMES = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function entries(value) { return String(value ?? '').replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean); }
function markdownAttachment(entry) {
  const match = entry.match(/^(!?)\[([^\]]+)\]\((https:\/\/[^\s]+)\)$/i);
  return match ? { filename: match[2], url: match[3], ...(match[1] ? { embeddedImage: true } : {}) } : null;
}
function htmlImageAttachment(entry) {
  const match = entry.match(/^<img\b([^>]*)\/?\s*>$/i);
  if (!match) return null;
  const attributes = new Map();
  for (const attribute of match[1].matchAll(/\b(src|alt)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    attributes.set(attribute[1].toLowerCase(), attribute[2] ?? attribute[3] ?? '');
  }
  const url = attributes.get('src');
  if (!url) return null;
  const alt = attributes.get('alt')?.trim() ?? '';
  const filename = COVER_EXTENSIONS.has(extensionOf(alt)) ? alt : 'image';
  return { filename, url, embeddedImage: true };
}

export function isGitHubAttachmentUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && /^\/user-attachments\/(?:files|assets)\//.test(url.pathname);
  } catch { return false; }
}

export function parseSubmittedAttachments(value) {
  const attachments = []; const invalidEntries = []; const seen = new Set();
  for (const entry of entries(value)) {
    const attachment = markdownAttachment(entry) ?? htmlImageAttachment(entry);
    if (!attachment || !isGitHubAttachmentUrl(attachment.url)) { invalidEntries.push(entry); continue; }
    if (!seen.has(attachment.url)) { seen.add(attachment.url); attachments.push(attachment); }
  }
  return { attachments, invalidEntries };
}

export function extensionOf(filename) { return String(filename).match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? ''; }
export function normaliseFilename(value) {
  const filename = String(value ?? '').trim();
  if (!filename || filename !== filename.replace(/[\\/]/g, '') || /[\0-\x1f\x7f]/.test(filename) || filename === '.' || filename === '..') return null;
  const dot = filename.lastIndexOf('.');
  const normalised = dot > 0 ? `${filename.slice(0, dot)}.${filename.slice(dot + 1).toLowerCase()}` : filename;
  const basename = normalised.split('.')[0];
  return WINDOWS_RESERVED_BASENAMES.test(basename) ? null : normalised;
}
export function isImageFilename(filename) { return COVER_EXTENSIONS.has(extensionOf(filename)); }
export function formatFileSize(bytes) {
  if (bytes < 1000) return `${bytes} B`;
  const kilobytes = Math.round(bytes / 100) / 10;
  if (kilobytes < 1000) return `${kilobytes} kB`;
  return `${Math.round(bytes / 100_000) / 10} MB`;
}

export function validateAttachmentNames(files, { allowUnresolvedImages = false } = {}) {
  const errors = []; const seenByNamespace = new Map();
  for (const file of files) {
    const filename = normaliseFilename(file.filename);
    if (!filename) { errors.push({ field: file.field, found: file.filename, message: 'Attachment filenames cannot contain paths, control characters, or reserved filenames.' }); continue; }
    file.filename = filename;
    if (allowUnresolvedImages && file.embeddedImage && !extensionOf(filename)) continue;
    const namespace = file.kind === 'cover' ? 'root' : 'downloads';
    const seen = seenByNamespace.get(namespace) ?? new Set();
    if (seen.has(filename.toLowerCase())) errors.push({ field: file.field, found: filename, message: 'Attachment filenames must be unique, even when they differ only by letter case.' });
    seen.add(filename.toLowerCase());
    seenByNamespace.set(namespace, seen);
  }
  return errors;
}
export function validateAttachmentSelection(files, { allowUnresolvedImages = false } = {}) {
  const errors = validateAttachmentNames(files, { allowUnresolvedImages });
  if (files.length > MAX_FILES) errors.push({ field: 'Attachments', message: `Upload no more than ${MAX_FILES} files total, including the cover and two required PDFs.` });
  for (const file of files) {
    const extension = extensionOf(file.filename); const allowed = file.kind === 'cover' ? COVER_EXTENSIONS : DOWNLOAD_EXTENSIONS;
    const unresolvedImage = allowUnresolvedImages && file.embeddedImage && !extension;
    if (!allowed.has(extension) && !unresolvedImage) errors.push({ field: file.field, found: file.filename, message: file.kind === 'cover' ? 'The cover must be a PNG, JPG, JPEG, or WebP image.' : 'Supported downloads are PDF, ZIP, PNG, JPG/JPEG, WebP, TXT, MD, CSV, and JSON.' });
    if (file.role && extension !== 'pdf') errors.push({ field: file.field, found: file.filename, message: 'The required reader-order and print-ready uploads must be PDFs.' });
  }
  return errors;
}

function imageExtensionOfBytes(bytes) {
  const at = (index) => bytes[index] ?? -1;
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => at(index) === byte)) return 'png';
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'jpg';
  if (new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') return 'webp';
  return null;
}

export function resolveEmbeddedImageFilenames(files) {
  const usedByNamespace = new Map();
  for (const file of files.filter((candidate) => !candidate.embeddedImage || extensionOf(candidate.filename))) {
    const namespace = file.kind === 'cover' ? 'root' : 'downloads';
    const used = usedByNamespace.get(namespace) ?? new Set();
    used.add(file.filename.toLowerCase()); usedByNamespace.set(namespace, used);
  }
  for (const file of files.filter((candidate) => candidate.embeddedImage && !extensionOf(candidate.filename))) {
    const extension = imageExtensionOfBytes(file.bytes ?? new Uint8Array());
    if (!extension) continue;
    const namespace = file.kind === 'cover' ? 'root' : 'downloads';
    const used = usedByNamespace.get(namespace) ?? new Set();
    const stem = file.kind === 'cover' ? 'cover' : (normaliseFilename(file.filename) ?? 'image');
    let filename = `${stem}.${extension}`; let suffix = 2;
    while (used.has(filename.toLowerCase())) { filename = `${stem}-${suffix}.${extension}`; suffix += 1; }
    file.filename = filename; used.add(filename.toLowerCase()); usedByNamespace.set(namespace, used);
  }
}

export function allowedRedirectHost(hostname) { return REDIRECT_HOSTS.some((rule) => rule.test(hostname)); }
export async function fetchAttachment(url, fetchImpl = globalThis.fetch) {
  if (!isGitHubAttachmentUrl(url)) throw new Error('Only direct GitHub file attachments can be downloaded. Please attach the source file directly to this issue.');
  let current = new URL(url);
  for (let hop = 0; hop <= 5; hop += 1) {
    const response = await fetchImpl(current, { redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      if (hop === 5) throw new Error('The upload redirected more than five times. Please attach the file again.');
      const location = response.headers.get('location');
      if (!location) throw new Error('The upload returned a redirect without a destination. Please attach the file again.');
      const next = new URL(location, current);
      if (next.protocol !== 'https:' || !allowedRedirectHost(next.hostname)) throw new Error('The upload redirected to an unapproved host. Please attach the source file directly to this issue.');
      current = next; continue;
    }
    if (!response.ok) throw new Error(`The upload could not be downloaded (HTTP ${response.status}). Please attach it again.`);
    if (current.hostname !== 'github.com' && !allowedRedirectHost(current.hostname)) throw new Error('The upload was served by an unapproved host. Please attach it again.');
    return new Uint8Array(await response.arrayBuffer());
  }
  throw new Error('The upload could not be downloaded.');
}

function validText(bytes, parseJson = false) {
  try { const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes); if (value.includes('\0')) return false; if (parseJson) JSON.parse(value); return true; } catch { return false; }
}
export function hasValidContent(filename, bytes) {
  const ext = extensionOf(filename); const at = (index) => bytes[index] ?? -1;
  if (ext === 'pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  if (ext === 'zip') return at(0) === 0x50 && at(1) === 0x4b && [0x03, 0x05, 0x07].includes(at(2)) && [0x04, 0x06, 0x08].includes(at(3));
  if (ext === 'png') return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => at(index) === byte);
  if (ext === 'jpg' || ext === 'jpeg') return at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff;
  if (ext === 'webp') return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  return validText(bytes, ext === 'json');
}
export function validateDownloadedFiles(files) {
  const errors = []; let total = 0;
  for (const file of files) {
    const bytes = file.bytes?.byteLength ?? 0; total += bytes; const limit = isImageFilename(file.filename) ? MAX_IMAGE_BYTES : MAX_OTHER_BYTES;
    if (bytes > limit) { const guidance = file.kind === 'cover' ? ' Resize or compress the cover before attaching it again.' : ' Reduce the file size before attaching it again.'; errors.push({ field: file.field, found: file.filename, message: `This file is ${formatFileSize(bytes)}; the limit is ${formatFileSize(limit)}.${guidance}` }); }
    if (!hasValidContent(file.filename, file.bytes ?? new Uint8Array())) errors.push({ field: file.field, found: file.filename, message: 'The file content does not match its extension. Please attach a valid file.' });
  }
  if (total > MAX_TOTAL_BYTES) errors.push({ field: 'Attachments', message: `All uploads total ${formatFileSize(total)}; the limit is ${formatFileSize(MAX_TOTAL_BYTES)}.` });
  return errors;
}

export function hasCheckedConsent(value) { return /^\s*-\s*\[x\]/im.test(value ?? ''); }
export function zineValidationComment(errors) { const count = errors.length; return ['Thanks for submitting an Activity Guide zine to Processing Community Day!', '', `We couldn't create a review pull request yet because **${count} ${count === 1 ? 'field needs' : 'fields need'} attention**:`, '', ...errors.map(formatError), '', 'Please edit and save this issue with the corrected information. Upload files directly to their form fields; external links are not accepted.'].join('\n'); }
export function yamlScalar(value) { return JSON.stringify(String(value)); }
export function makeZineMarkdown(slug, order, description) { return ['---', `id: ${yamlScalar(slug)}`, `order: ${order}`, '---', '', description.trim(), ''].join('\n'); }
export function makeZinePrBody({ issueNumber, title, submitterLogin, maintainerNotes = '' }) {
  const submittedBy = submitterLogin ? `@${submitterLogin}` : 'the submitter';
  return [
    `Closes #${issueNumber}`,
    '',
    `This publication-ready Activity Guide was generated from **"${title}"** and submitted by ${submittedBy}.`,
    ...(maintainerNotes ? ['', '### Maintainer notes', '', maintainerNotes] : []),
    '',
    '### Reviewer checklist',
    '',
    '- [ ] Review all files and reader-order accessibility.',
    '- [ ] Verify generated metadata.',
    '- [ ] Verify the Netlify preview.',
  ].join('\n');
}
