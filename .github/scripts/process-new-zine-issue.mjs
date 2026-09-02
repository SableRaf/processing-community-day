import fs from 'node:fs/promises';
import path from 'node:path';
import { isValidHttpUrl, parseIssueSections, required, slugify } from './event-issue-helpers.mjs';
import {
  ZINE_TEMPLATE_HEADING, fetchAttachment, formatFileSize, hasCheckedConsent,
  makeZineMarkdown, makeZinePrBody, parseSubmittedAttachments, resolveEmbeddedImageFilenames, validateAttachmentSelection,
  validateDownloadedFiles, zineValidationComment,
} from './zine-intake-helpers.mjs';

const WORKSPACE = process.cwd();
const RUNNER_TEMP = process.env.RUNNER_TEMP ?? path.join(WORKSPACE, '.tmp');
const OUTPUT_PATH = process.env.GITHUB_OUTPUT;
const payload = JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
const issue = payload.issue;
const issueNumber = issue.number;
const issueBody = issue.body ?? '';

async function setOutput(key, value) { if (OUTPUT_PATH) await fs.appendFile(OUTPUT_PATH, `${key}=${String(value)}\n`); }
function issueUrl() {
  if (issue.html_url) return issue.html_url;
  const repository = payload.repository?.full_name ?? process.env.GITHUB_REPOSITORY;
  return repository ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repository}/issues/${issueNumber}` : `issue #${issueNumber}`;
}
async function folderExists(folder) { try { await fs.access(folder); return true; } catch { return false; } }
function addAttachmentErrors(errors, field, parsed, requiredRole) {
  if (parsed.invalidEntries.length) {
    errors.push({ field, message: 'Attach files directly in this field using GitHub’s upload control. External URLs and prose are not accepted; download the source file and attach it here.' });
  }
  if (requiredRole && parsed.attachments.length !== 1) {
    errors.push({ field, message: parsed.attachments.length ? 'Keep exactly one uploaded PDF in this field.' : 'Upload one PDF in this field.' });
  }
}
function ordersFromEnvironment() {
  return (process.env.ZINE_OPEN_PR_ORDERS ?? '').split(',').map(Number).filter(Number.isFinite);
}
async function publishedOrders() {
  const root = path.join(WORKSPACE, 'pcd-website/src/content/zines');
  const dirs = await fs.readdir(root, { withFileTypes: true }); const values = [];
  for (const dir of dirs.filter((entry) => entry.isDirectory())) {
    try { const text = await fs.readFile(path.join(root, dir.name, 'index.md'), 'utf8'); const match = text.match(/^order:\s*(\d+)\s*$/m); if (match) values.push(Number(match[1])); } catch { /* ignored: normal validation reports broken entries at build time */ }
  }
  return values;
}

async function main() {
  await fs.mkdir(RUNNER_TEMP, { recursive: true });
  if (!issueBody.includes(ZINE_TEMPLATE_HEADING)) { console.log('[process-new-zine-issue] template heading not found — skipping'); await setOutput('valid', 'skip'); return; }
  const fields = parseIssueSections(issueBody); const errors = [];
  const title = required(fields, 'Title', errors); const topic = required(fields, 'Topic', errors); const createdBy = required(fields, 'Creator(s)', errors);
  const summary = required(fields, 'Short summary', errors); const description = required(fields, 'Full description', errors);
  const tags = [...new Set((fields.get('Tags') ?? '').split(',').map((value) => value.trim()).filter(Boolean))];
  const languages = [...new Set((fields.get('Language(s)') ?? '').split(',').map((value) => value.trim()).filter(Boolean))];
  const createdByUrl = fields.get('Creator URL')?.trim() ?? '';
  if (createdByUrl && !isValidHttpUrl(createdByUrl)) errors.push({ field: 'Creator URL', found: createdByUrl, message: 'Enter a valid HTTP(S) URL.' });
  if (!hasCheckedConsent(fields.get('License consent'))) errors.push({ field: 'License consent', message: 'Confirm that the material can be licensed under CC BY-SA 4.0.' });

  const reader = parseSubmittedAttachments(fields.get('Reader-order PDF') ?? fields.get('Reader-order PDF URL') ?? '');
  const print = parseSubmittedAttachments(fields.get('Print-ready PDF') ?? fields.get('Print-ready PDF URL') ?? '');
  const cover = parseSubmittedAttachments(fields.get('Cover image') ?? '');
  const additional = parseSubmittedAttachments(fields.get('Additional files') ?? '');
  addAttachmentErrors(errors, 'Reader-order PDF', reader, true); addAttachmentErrors(errors, 'Print-ready PDF', print, true);
  addAttachmentErrors(errors, 'Cover image', cover, false); addAttachmentErrors(errors, 'Additional files', additional, false);
  if (cover.attachments.length > 1) errors.push({ field: 'Cover image', message: 'Upload no more than one cover image.' });
  const files = [
    ...reader.attachments.map((attachment) => ({ ...attachment, field: 'Reader-order PDF', role: 'reader-order', kind: 'download' })),
    ...print.attachments.map((attachment) => ({ ...attachment, field: 'Print-ready PDF', role: 'print-ready', kind: 'download' })),
    ...cover.attachments.map((attachment) => ({ ...attachment, field: 'Cover image', kind: 'cover' })),
    ...additional.attachments.map((attachment) => ({ ...attachment, field: 'Additional files', kind: 'download' })),
  ];
  errors.push(...validateAttachmentSelection(files, { allowUnresolvedImages: true }));
  const slug = slugify(title); const publishedDir = path.join(WORKSPACE, 'pcd-website/src/content/zines', slug);
  const reservedSlugs = new Set((process.env.ZINE_RESERVED_SLUGS ?? '').split(',').filter(Boolean));
  if (!slug) errors.push({ field: 'Title', message: 'Use at least one letter or number so we can create a URL slug.' });
  else if (reservedSlugs.has(slug)) errors.push({ field: 'Title', found: title, message: `The generated slug \`${slug}\` is already staged by another open zine review PR.` });
  else if (await folderExists(publishedDir) && process.env.ZINE_CURRENT_SLUG !== slug) errors.push({ field: 'Title', found: title, message: `The generated slug \`${slug}\` already exists in published zines.` });
  if (!errors.length) {
    await Promise.all(files.map(async (file) => { try { file.bytes = await fetchAttachment(file.url); } catch (error) { errors.push({ field: file.field, found: file.filename, message: error.message }); } }));
    if (!errors.length) {
      resolveEmbeddedImageFilenames(files);
      errors.push(...validateAttachmentSelection(files));
      if (!errors.length) errors.push(...validateDownloadedFiles(files));
    }
  }
  if (errors.length) {
    const comment = path.join(RUNNER_TEMP, `zine-validation-${issueNumber}.md`); await fs.writeFile(comment, zineValidationComment(errors));
    await setOutput('valid', 'false'); await setOutput('validation_comment_path', comment); return;
  }
  const knownOrders = [...await publishedOrders(), ...ordersFromEnvironment()];
  const currentOrderValue = process.env.ZINE_CURRENT_ORDER?.trim() ?? '';
  const previousOrder = currentOrderValue ? Number(currentOrderValue) : Number.NaN;
  const order = Number.isInteger(previousOrder) && previousOrder >= 0 ? previousOrder : (Math.max(0, ...knownOrders) + 1);
  const downloads = files.filter((file) => file.kind === 'download').map((file) => ({ file: file.filename, file_size: formatFileSize(file.bytes.byteLength), ...(file.role ? { role: file.role } : {}) }));
  const metadata = { id: slug, title, topic, created_by: createdBy, summary, downloads, license: 'CC BY-SA 4.0', source_url: issueUrl() };
  if (tags.length) metadata.tags = tags; if (languages.length) metadata.languages = languages; if (createdByUrl) metadata.created_by_url = createdByUrl;
  if (cover.attachments.length) metadata.cover = { src: files.find((file) => file.kind === 'cover').filename, alt: title };
  for (const [field, key] of [['Activity type', 'activity_type'], ['Zine format', 'zine_format'], ['Duration of the activity', 'duration'], ['Materials', 'materials'], ['Preferred attribution', 'attribution']]) {
    const value = (fields.get(field) ?? (field === 'Duration of the activity' ? fields.get('Duration') : ''))?.trim();
    if (value) metadata[key] = value;
  }
  await fs.mkdir(path.join(publishedDir, 'downloads'), { recursive: true });
  await fs.writeFile(path.join(publishedDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  await fs.writeFile(path.join(publishedDir, 'index.md'), makeZineMarkdown(slug, order, description));
  for (const file of files) await fs.writeFile(path.join(publishedDir, file.kind === 'cover' ? file.filename : path.join('downloads', file.filename)), file.bytes);
  const prBodyPath = path.join(RUNNER_TEMP, `zine-pr-body-${issueNumber}.md`); await fs.writeFile(prBodyPath, makeZinePrBody({ issueNumber, title, submitterLogin: issue.user?.login ?? '', maintainerNotes: fields.get('Maintainer notes')?.trim() ?? '' }));
  await setOutput('valid', 'true'); await setOutput('branch', `automation/new-zine-${issueNumber}`); await setOutput('commit_message', `Publish ${title} zine from issue #${issueNumber}`); await setOutput('pr_title', `Review zine: ${title}`); await setOutput('pr_body_path', prBodyPath); await setOutput('zine_title', title); await setOutput('zine_slug', slug);
}

await main().catch(async (error) => { console.error('[process-new-zine-issue] unhandled error:', error); const comment = path.join(RUNNER_TEMP, `zine-validation-${issueNumber}.md`); await fs.mkdir(RUNNER_TEMP, { recursive: true }); await fs.writeFile(comment, 'An unexpected error occurred while processing this zine submission. Please edit and save the issue to try again.'); await setOutput('valid', 'false'); await setOutput('validation_comment_path', comment); process.exitCode = 1; });
