import fs from 'node:fs/promises';
import path from 'node:path';
import { isValidHttpUrl, parseIssueSections, required, slugify } from './event-issue-helpers.mjs';
import { ZINE_TEMPLATE_HEADING, hasCheckedConsent, isPdfUrl, makeDraftMarkdown, makeZinePrBody, parseSubmittedFileUrls, zineValidationComment } from './zine-intake-helpers.mjs';

const WORKSPACE = process.cwd();
const RUNNER_TEMP = process.env.RUNNER_TEMP ?? path.join(WORKSPACE, '.tmp');
const OUTPUT_PATH = process.env.GITHUB_OUTPUT;
const payload = JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
const issue = payload.issue;
const issueNumber = issue.number;
const issueBody = issue.body ?? '';

async function setOutput(key, value) {
  if (OUTPUT_PATH) await fs.appendFile(OUTPUT_PATH, `${key}=${String(value)}\n`);
}

function issueUrl() {
  if (issue.html_url) return issue.html_url;
  const repository = payload.repository?.full_name ?? process.env.GITHUB_REPOSITORY;
  return repository ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repository}/issues/${issueNumber}` : `issue #${issueNumber}`;
}

async function folderExists(folder) {
  try { await fs.access(folder); return true; } catch { return false; }
}

async function main() {
  await fs.mkdir(RUNNER_TEMP, { recursive: true });
  if (!issueBody.includes(ZINE_TEMPLATE_HEADING)) {
    console.log('[process-new-zine-issue] template heading not found — skipping');
    await setOutput('valid', 'skip');
    return;
  }

  const fields = parseIssueSections(issueBody);
  const errors = [];
  const title = required(fields, 'Title', errors);
  const topic = required(fields, 'Topic', errors);
  const tags = [...new Set((fields.get('Tags') ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean))];
  const languages = [...new Set((fields.get('Language(s)') ?? '')
    .split(',')
    .map((language) => language.trim())
    .filter(Boolean))];
  const createdBy = required(fields, 'Creator(s)', errors);
  const createdByUrl = fields.get('Creator URL')?.trim() ?? '';
  if (createdByUrl && !isValidHttpUrl(createdByUrl)) {
    errors.push({ field: 'Creator URL', found: createdByUrl, message: 'Enter a valid HTTP(S) URL.' });
  }
  const summary = required(fields, 'Short summary', errors);
  const description = required(fields, 'Full description', errors);
  const readerOrderValue = fields.get('Reader-order PDF') ?? fields.get('Reader-order PDF URL') ?? '';
  const printReadyValue = fields.get('Print-ready PDF') ?? fields.get('Print-ready PDF URL') ?? '';
  const additionalFilesValue = fields.get('Additional files') ?? '';
  const readerOrderFiles = parseSubmittedFileUrls(readerOrderValue);
  const printReadyFiles = parseSubmittedFileUrls(printReadyValue);
  const additionalFiles = parseSubmittedFileUrls(additionalFilesValue);
  if (readerOrderFiles.invalidEntries.length) {
    errors.push({ field: 'Reader-order PDF', message: 'Keep only one uploaded file link or raw HTTP(S) URL in this field; remove any descriptions or unrelated links.' });
  } else if (readerOrderFiles.urls.length !== 1) {
    errors.push({ field: 'Reader-order PDF', message: readerOrderFiles.urls.length ? 'Keep exactly one PDF link in this field; remove any other links.' : 'Upload one PDF in this field.' });
  } else if (!isPdfUrl(readerOrderFiles.urls[0])) {
    errors.push({ field: 'Reader-order PDF', found: readerOrderFiles.urls[0], message: 'The attached file must be a PDF.' });
  }
  if (printReadyFiles.invalidEntries.length) {
    errors.push({ field: 'Print-ready PDF', message: 'Keep only one uploaded file link or raw HTTP(S) URL in this field; remove any descriptions or unrelated links.' });
  } else if (printReadyFiles.urls.length !== 1) {
    errors.push({ field: 'Print-ready PDF', message: printReadyFiles.urls.length ? 'Keep exactly one PDF link in this field; remove any other links.' : 'Upload one PDF in this field.' });
  } else if (!isPdfUrl(printReadyFiles.urls[0])) {
    errors.push({ field: 'Print-ready PDF', found: printReadyFiles.urls[0], message: 'The attached file must be a PDF.' });
  }
  if (additionalFiles.invalidEntries.length) {
    errors.push({ field: 'Additional files', message: 'Use only uploaded file links (one per line) or raw HTTP(S) URLs; remove descriptions and unrelated links.' });
  }
  if (!hasCheckedConsent(fields.get('License consent'))) errors.push({ field: 'License consent', message: 'Confirm that the material can be licensed under CC BY-SA 4.0.' });

  const slug = slugify(title);
  if (!slug) errors.push({ field: 'Title', message: 'Use at least one letter or number so we can create a URL slug.' });
  const publishedDir = path.join(WORKSPACE, 'pcd-website/src/content/zines', slug);
  const draftDir = path.join(WORKSPACE, 'pcd-website/src/content/zines-drafts', slug);
  const reservedDraftSlugs = new Set((process.env.ZINE_RESERVED_DRAFT_SLUGS ?? '').split(',').filter(Boolean));
  if (slug && reservedDraftSlugs.has(slug)) {
    errors.push({ field: 'Title', found: title, message: `The generated slug \`${slug}\` is already staged by another open zine review PR.` });
  } else if (slug && await folderExists(publishedDir)) {
    errors.push({ field: 'Title', found: title, message: `The generated slug \`${slug}\` already exists in published or draft zines.` });
  } else if (slug && await folderExists(draftDir)) {
    let existingIssueNumber;
    try {
      existingIssueNumber = JSON.parse(await fs.readFile(path.join(draftDir, 'submission.json'), 'utf8')).intake?.issue_number;
    } catch {
      // A malformed draft must not be overwritten by an unrelated submission.
    }
    if (existingIssueNumber !== issueNumber) {
      errors.push({ field: 'Title', found: title, message: `The generated slug \`${slug}\` already exists in published or draft zines.` });
    }
  }

  if (errors.length) {
    const validationCommentPath = path.join(RUNNER_TEMP, `zine-validation-${issueNumber}.md`);
    await fs.writeFile(validationCommentPath, zineValidationComment(errors));
    await setOutput('valid', 'false');
    await setOutput('validation_comment_path', validationCommentPath);
    return;
  }

  const submission = {
    id: slug,
    title,
    topic,
    created_by: createdBy,
    summary,
    source_pdfs: [
      { role: 'reader-order', url: readerOrderFiles.urls[0] },
      { role: 'print-ready', url: printReadyFiles.urls[0] },
    ],
    license: 'CC BY-SA 4.0',
    source_issue_url: issueUrl(),
    intake: {
      issue_number: issueNumber,
      submitted_by_github: issue.user?.login ?? '',
      submitted_date: new Date().toISOString().slice(0, 10),
      maintainer_notes: fields.get('Maintainer notes')?.trim() ?? '',
    },
    description,
  };
  if (tags.length) submission.tags = tags;
  if (languages.length) submission.languages = languages;
  if (additionalFiles.urls.length) submission.additional_files = additionalFiles.urls;
  if (createdByUrl) submission.created_by_url = createdByUrl;
  for (const [field, key] of [
    ['Activity type', 'activity_type'],
    ['Zine format', 'zine_format'],
    ['Duration', 'duration'],
    ['Materials', 'materials'],
    ['Preferred attribution', 'attribution'],
  ]) {
    const value = fields.get(field)?.trim();
    if (value) submission[key] = value;
  }
  await fs.mkdir(draftDir, { recursive: true });
  await fs.writeFile(path.join(draftDir, 'submission.json'), `${JSON.stringify(submission, null, 2)}\n`);
  await fs.writeFile(path.join(draftDir, 'index.md'), makeDraftMarkdown(slug, description));
  const prBodyPath = path.join(RUNNER_TEMP, `zine-pr-body-${issueNumber}.md`);
  await fs.writeFile(prBodyPath, makeZinePrBody({ issueNumber, title, submitterLogin: issue.user?.login ?? '', submission }));
  await setOutput('valid', 'true');
  await setOutput('branch', `automation/new-zine-${issueNumber}`);
  await setOutput('commit_message', `Stage ${title} zine from issue #${issueNumber}`);
  await setOutput('pr_title', `Review zine: ${title}`);
  await setOutput('pr_body_path', prBodyPath);
  await setOutput('zine_title', title);
}

await main().catch(async (error) => {
  console.error('[process-new-zine-issue] unhandled error:', error);
  const validationCommentPath = path.join(RUNNER_TEMP, `zine-validation-${issueNumber}.md`);
  await fs.writeFile(validationCommentPath, 'An unexpected error occurred while processing this zine submission. Please edit and save the issue to try again.');
  await setOutput('valid', 'false');
  await setOutput('validation_comment_path', validationCommentPath);
  process.exitCode = 1;
});
