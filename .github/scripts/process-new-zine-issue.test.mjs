import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SCRIPT = new URL('./process-new-zine-issue.mjs', import.meta.url).pathname;
const ROOT = path.resolve(path.dirname(SCRIPT), '../..');
const DRAFTS = path.join(ROOT, 'pcd-website/src/content/zines-drafts');
const PUBLISHED = path.join(ROOT, 'pcd-website/src/content/zines');
const created = new Set();

function attachment(filename, url) {
  return url ? `[${filename}](${url})` : '';
}

function body({ title = 'Intake Test Zine 781', tags = '', languages = '', creatorUrl = '', readerUrl = 'https://github.com/user-attachments/files/10000001/reader.pdf', printUrl = 'https://github.com/user-attachments/files/10000002/print.pdf', additionalFiles = '', license = true, optional = false } = {}) {
  return [
    '### Title', title, '', '### Topic', 'Creative coding', '', '### Creator(s)', 'Test Creator', '',
    '### Tags', tags || (optional ? 'beginner, creative coding, beginner' : '_No response_'), '',
    '### Language(s)', languages || (optional ? 'English, Spanish, English' : '_No response_'), '',
    '### Creator URL', creatorUrl || '_No response_', '',
    '### Short summary', 'A concise test summary.', '', '### Full description', 'A full **test** description.', '',
    '### Reader-order PDF', attachment('Reader order.pdf', readerUrl), '', '### Print-ready PDF', attachment('Print ready.pdf', printUrl), '',
    '### Additional files', additionalFiles || (optional ? [
      attachment('worksheet.pdf', 'https://github.com/user-attachments/files/10000003/worksheet.pdf'),
      attachment('source files.zip', 'https://github.com/user-attachments/files/10000004/source.files.zip'),
      attachment('worksheet.pdf', 'https://github.com/user-attachments/files/10000003/worksheet.pdf'),
    ].join('\n') : '_No response_'), '',
    '### Activity type', optional ? 'Workshop' : '_No response_', '', '### Zine format', optional ? 'Single-sheet folded zine' : '_No response_', '',
    '### Duration', optional ? '90 minutes' : '_No response_', '',
    '### Materials', optional ? 'Paper and pens' : '_No response_', '', '### Preferred attribution', optional ? 'Test Creator, CC BY-SA 4.0' : '_No response_', '',
    '### Maintainer notes', optional ? 'Public maintainer note.' : '_No response_', '',
    '### License consent', license ? '- [x] I own or have permission to license this material under CC BY-SA 4.0.' : '- [ ] I own or have permission to license this material under CC BY-SA 4.0.',
  ].join('\n');
}

async function run(issueBody, { number = 781, login = 'zine-tester' } = {}) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pnzi-test-'));
  const eventPath = path.join(tmp, 'event.json');
  const outputPath = path.join(tmp, 'output.txt');
  await fs.writeFile(eventPath, JSON.stringify({ repository: { full_name: 'processing/processing-community-day' }, issue: { number, body: issueBody, html_url: `https://github.com/processing/processing-community-day/issues/${number}`, user: { login } } }));
  await fs.writeFile(outputPath, '');
  let exitCode = 0;
  try { await execFileAsync(process.execPath, [SCRIPT], { cwd: ROOT, env: { ...process.env, GITHUB_EVENT_PATH: eventPath, GITHUB_OUTPUT: outputPath, RUNNER_TEMP: tmp } }); }
  catch (error) { exitCode = error.code ?? 1; }
  const raw = await fs.readFile(outputPath, 'utf8');
  const outputs = Object.fromEntries(raw.trim().split('\n').filter(Boolean).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  return { tmp, outputs, exitCode };
}

after(async () => {
  await Promise.all([...created].map((slug) => fs.rm(path.join(DRAFTS, slug), { recursive: true, force: true })));
});

describe('process-new-zine-issue', () => {
  test('stages valid submissions with exact source roles, provenance, optional metadata, and markdown', async () => {
    const title = 'Intake Test Zine 781';
    const slug = 'intake-test-zine-781';
    created.add(slug);
    const { tmp, outputs } = await run(body({ title, optional: true }));
    assert.equal(outputs.valid, 'true');
    assert.equal(outputs.branch, 'automation/new-zine-781');
    const submission = JSON.parse(await fs.readFile(path.join(DRAFTS, slug, 'submission.json'), 'utf8'));
    assert.deepEqual(submission, {
      id: slug, title, topic: 'Creative coding', tags: ['beginner', 'creative coding'], languages: ['English', 'Spanish'], created_by: 'Test Creator', summary: 'A concise test summary.',
      source_pdfs: [{ role: 'reader-order', url: 'https://github.com/user-attachments/files/10000001/reader.pdf' }, { role: 'print-ready', url: 'https://github.com/user-attachments/files/10000002/print.pdf' }],
      additional_files: ['https://github.com/user-attachments/files/10000003/worksheet.pdf', 'https://github.com/user-attachments/files/10000004/source.files.zip'],
      license: 'CC BY-SA 4.0', source_issue_url: 'https://github.com/processing/processing-community-day/issues/781',
      intake: { issue_number: 781, submitted_by_github: 'zine-tester', submitted_date: new Date().toISOString().slice(0, 10), maintainer_notes: 'Public maintainer note.' },
      description: 'A full **test** description.', activity_type: 'Workshop', zine_format: 'Single-sheet folded zine',
      duration: '90 minutes', materials: 'Paper and pens', attribution: 'Test Creator, CC BY-SA 4.0',
    });
    assert.equal(await fs.readFile(path.join(DRAFTS, slug, 'index.md'), 'utf8'), '---\nid: "intake-test-zine-781"\n---\n\nA full **test** description.\n');
    const prBody = await fs.readFile(outputs.pr_body_path, 'utf8');
    assert.match(prBody, /Reader-order PDF/);
    assert.match(prBody, /\| Tags \| beginner, creative coding \|/);
    assert.match(prBody, /\| Language\(s\) \| English, Spanish \|/);
    assert.match(prBody, /\| Additional files \| https:\/\/github\.com\/user-attachments\/files\/10000003\/worksheet\.pdf, https:\/\/github\.com\/user-attachments\/files\/10000004\/source\.files\.zip \|/);
    assert.match(prBody, /\| Activity type \| Workshop \|/);
    assert.match(prBody, /\| Zine format \| Single-sheet folded zine \|/);
    assert.match(prBody, /commit them as `reader-order.pdf` and `print-ready.pdf`/);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  test('edited issues overwrite their own staged inputs and retain the stable branch', async () => {
    const slug = 'intake-test-zine-781';
    const { tmp, outputs } = await run(body({ title: 'Intake Test Zine 781', readerUrl: 'https://github.com/user-attachments/files/10000005/updated-reader.pdf' }));
    assert.equal(outputs.valid, 'true');
    assert.equal(outputs.branch, 'automation/new-zine-781');
    const submission = JSON.parse(await fs.readFile(path.join(DRAFTS, slug, 'submission.json'), 'utf8'));
    assert.equal(submission.source_pdfs[0].url, 'https://github.com/user-attachments/files/10000005/updated-reader.pdf');
    await fs.rm(tmp, { recursive: true, force: true });
  });

  test('keeps accepting raw URLs and former PDF URL headings on existing issues', async () => {
    const title = 'Intake Test Zine Legacy URLs';
    const slug = 'intake-test-zine-legacy-urls';
    const readerUrl = 'https://example.org/legacy-reader(v2).pdf';
    const printUrl = 'https://example.org/legacy-print.pdf';
    const additionalFiles = 'https://example.org/worksheet.pdf, https://example.org/source(v2).zip';
    created.add(slug);
    const legacyBody = body({ title, readerUrl, printUrl, additionalFiles })
      .replace('### Reader-order PDF', '### Reader-order PDF URL')
      .replace('### Print-ready PDF', '### Print-ready PDF URL')
      .replace(attachment('Reader order.pdf', readerUrl), readerUrl)
      .replace(attachment('Print ready.pdf', printUrl), printUrl);
    const { tmp, outputs } = await run(legacyBody, { number: 789 });
    assert.equal(outputs.valid, 'true');
    const submission = JSON.parse(await fs.readFile(path.join(DRAFTS, slug, 'submission.json'), 'utf8'));
    assert.deepEqual(submission.source_pdfs, [
      { role: 'reader-order', url: readerUrl },
      { role: 'print-ready', url: printUrl },
    ]);
    assert.deepEqual(submission.additional_files, [
      'https://example.org/worksheet.pdf',
      'https://example.org/source(v2).zip',
    ]);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  test('stages an optional creator URL and rejects an invalid one', async () => {
    const slug = 'intake-test-zine-creator-url';
    created.add(slug);
    let result = await run(body({ title: 'Intake Test Zine Creator URL', creatorUrl: 'https://example.org/creator' }), { number: 785 });
    assert.equal(result.outputs.valid, 'true');
    const submission = JSON.parse(await fs.readFile(path.join(DRAFTS, slug, 'submission.json'), 'utf8'));
    assert.equal(submission.created_by_url, 'https://example.org/creator');
    await fs.rm(result.tmp, { recursive: true, force: true });

    result = await run(body({ title: 'Intake Test Zine Invalid Creator URL', creatorUrl: 'ftp://example.org/creator' }), { number: 786 });
    assert.equal(result.outputs.valid, 'false');
    const comment = await fs.readFile(result.outputs.validation_comment_path, 'utf8');
    assert.match(comment, /Creator URL/);
    await fs.rm(result.tmp, { recursive: true, force: true });
  });

  test('rejects additional-file text without an upload and extracts multiple uploaded files', async () => {
    let result = await run(body({
      title: 'Intake Test Zine Invalid Additional Files',
      additionalFiles: 'See my site at [https://example.com](https://example.com) for the assets.',
    }), { number: 787 });
    assert.equal(result.outputs.valid, 'false');
    let comment = await fs.readFile(result.outputs.validation_comment_path, 'utf8');
    assert.match(comment, /Additional files/);
    assert.match(comment, /remove descriptions and unrelated links/);
    await fs.rm(result.tmp, { recursive: true, force: true });

    const slug = 'intake-test-zine-additional-files';
    created.add(slug);
    result = await run(body({
      title: 'Intake Test Zine Additional Files',
      additionalFiles: [
        attachment('worksheet.pdf', 'https://github.com/user-attachments/files/10000006/worksheet.pdf'),
        attachment('source.zip', 'https://github.com/user-attachments/files/10000007/source.zip'),
      ].join('\n'),
    }), { number: 788 });
    assert.equal(result.outputs.valid, 'true');
    const submission = JSON.parse(await fs.readFile(path.join(DRAFTS, slug, 'submission.json'), 'utf8'));
    assert.deepEqual(submission.additional_files, [
      'https://github.com/user-attachments/files/10000006/worksheet.pdf',
      'https://github.com/user-attachments/files/10000007/source.zip',
    ]);
    await fs.rm(result.tmp, { recursive: true, force: true });
  });

  test('rejects descriptive text beside an otherwise valid PDF attachment with a clear message', async () => {
    const readerUrl = 'https://github.com/user-attachments/files/10000009/reader.pdf';
    const issueBody = body({ title: 'Intake Test Zine Mixed PDF Field', readerUrl })
      .replace(attachment('Reader order.pdf', readerUrl), `${attachment('Reader order.pdf', readerUrl)}\nPreferred version for screens.`);
    const { tmp, outputs } = await run(issueBody, { number: 790 });
    assert.equal(outputs.valid, 'false');
    const comment = await fs.readFile(outputs.validation_comment_path, 'utf8');
    assert.match(comment, /Reader-order PDF/);
    assert.match(comment, /remove any descriptions or unrelated links/);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  test('reports missing fields, wrong file types, and unchecked license consent in one actionable comment', async () => {
    const { tmp, outputs } = await run(body({ title: '', readerUrl: 'https://github.com/user-attachments/files/10000008/file.zip', printUrl: '', license: false }), { number: 782 });
    assert.equal(outputs.valid, 'false');
    const comment = await fs.readFile(outputs.validation_comment_path, 'utf8');
    assert.match(comment, /Title/); assert.match(comment, /Reader-order PDF/); assert.match(comment, /Print-ready PDF/);
    assert.match(comment, /attached file must be a PDF/); assert.match(comment, /License consent/);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  test('rejects duplicate published and other-issue draft slugs, and skips unrelated templates', async () => {
    const publishedSlug = 'intake-published-conflict';
    await fs.mkdir(path.join(PUBLISHED, publishedSlug), { recursive: true });
    try {
      let result = await run(body({ title: 'Intake Published Conflict' }), { number: 783 });
      assert.equal(result.outputs.valid, 'false');
      await fs.rm(result.tmp, { recursive: true, force: true });
    } finally { await fs.rm(path.join(PUBLISHED, publishedSlug), { recursive: true, force: true }); }
    const draftSlug = 'intake-draft-conflict';
    created.add(draftSlug);
    await fs.mkdir(path.join(DRAFTS, draftSlug), { recursive: true });
    await fs.writeFile(path.join(DRAFTS, draftSlug, 'submission.json'), JSON.stringify({ intake: { issue_number: 1 } }));
    let result = await run(body({ title: 'Intake Draft Conflict' }), { number: 784 });
    assert.equal(result.outputs.valid, 'false');
    await fs.rm(result.tmp, { recursive: true, force: true });
    result = await run('### Title\nNot a zine');
    assert.equal(result.outputs.valid, 'skip');
    await fs.rm(result.tmp, { recursive: true, force: true });
  });

  test('workflow keeps edited issues on one branch and upserts one marked status comment', async () => {
    const workflow = await fs.readFile(path.join(ROOT, '.github/workflows/new-zine-intake.yml'), 'utf8');
    const processor = await fs.readFile(SCRIPT, 'utf8');
    const issueTemplate = await fs.readFile(path.join(ROOT, '.github/ISSUE_TEMPLATE/05-new-zine.yml'), 'utf8');
    assert.match(workflow, /branch: \$\{\{ needs\.process-new-zine\.outputs\.branch \}\}/);
    assert.match(processor, /automation\/new-zine-\$\{issueNumber\}/);
    assert.match(processor, /ZINE_RESERVED_DRAFT_SLUGS/);
    assert.match(workflow, /STATUS_COMMENT_MARKER: <!-- new-zine-intake-status -->/);
    assert.match(workflow, /pulls\.listFiles/);
    assert.match(workflow, /const existing = comments\.find/);
    assert.match(workflow, /issues\.updateComment/);
    assert.match(issueTemplate, /type: textarea\s+id: reader_order_pdf/);
    assert.match(issueTemplate, /type: textarea\s+id: print_ready_pdf/);
    assert.match(issueTemplate, /type: textarea\s+id: additional_files/);
    assert.doesNotMatch(issueTemplate, /Public and stable links/);
  });
});
