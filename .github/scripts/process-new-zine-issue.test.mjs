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

function body({ title = 'Intake Test Zine 781', tags = '', languages = '', creatorUrl = '', readerUrl = 'https://example.org/reader.pdf', printUrl = 'https://example.org/print.pdf', additionalFiles = '', license = true, links = true, optional = false } = {}) {
  return [
    '### Title', title, '', '### Topic', 'Creative coding', '', '### Creator(s)', 'Test Creator', '',
    '### Tags', tags || (optional ? 'beginner, creative coding, beginner' : '_No response_'), '',
    '### Language(s)', languages || (optional ? 'English, Spanish, English' : '_No response_'), '',
    '### Creator URL', creatorUrl || '_No response_', '',
    '### Short summary', 'A concise test summary.', '', '### Full description', 'A full **test** description.', '',
    '### Reader-order PDF URL', readerUrl, '', '### Print-ready PDF URL', printUrl, '',
    '### Additional files', additionalFiles || (optional ? 'https://example.org/worksheet.pdf, https://example.org/source.zip, https://example.org/worksheet.pdf' : '_No response_'), '',
    '### Activity type', optional ? 'Workshop' : '_No response_', '', '### Zine format', optional ? 'Single-sheet folded zine' : '_No response_', '',
    '### Duration', optional ? '90 minutes' : '_No response_', '',
    '### Materials', optional ? 'Paper and pens' : '_No response_', '', '### Preferred attribution', optional ? 'Test Creator, CC BY-SA 4.0' : '_No response_', '',
    '### Maintainer notes', optional ? 'Public maintainer note.' : '_No response_', '',
    '### License consent', license ? '- [x] I own or have permission to license this material under CC BY-SA 4.0.' : '- [ ] I own or have permission to license this material under CC BY-SA 4.0.', '',
    '### Public and stable links', links ? '- [x] I confirm all links above are publicly accessible without login and are stable, non-expiring URLs.' : '- [ ] I confirm all links above are publicly accessible without login and are stable, non-expiring URLs.',
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
      source_pdfs: [{ role: 'reader-order', url: 'https://example.org/reader.pdf' }, { role: 'print-ready', url: 'https://example.org/print.pdf' }],
      additional_files: ['https://example.org/worksheet.pdf', 'https://example.org/source.zip'],
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
    assert.match(prBody, /\| Additional files \| https:\/\/example\.org\/worksheet\.pdf, https:\/\/example\.org\/source\.zip \|/);
    assert.match(prBody, /\| Activity type \| Workshop \|/);
    assert.match(prBody, /\| Zine format \| Single-sheet folded zine \|/);
    assert.match(prBody, /commit them as `reader-order.pdf` and `print-ready.pdf`/);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  test('edited issues overwrite their own staged inputs and retain the stable branch', async () => {
    const slug = 'intake-test-zine-781';
    const { tmp, outputs } = await run(body({ title: 'Intake Test Zine 781', readerUrl: 'https://example.org/updated-reader.pdf' }));
    assert.equal(outputs.valid, 'true');
    assert.equal(outputs.branch, 'automation/new-zine-781');
    const submission = JSON.parse(await fs.readFile(path.join(DRAFTS, slug, 'submission.json'), 'utf8'));
    assert.equal(submission.source_pdfs[0].url, 'https://example.org/updated-reader.pdf');
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

  test('rejects invalid additional file URLs and accepts comma-separated HTTP(S) URLs', async () => {
    let result = await run(body({
      title: 'Intake Test Zine Invalid Additional Files',
      additionalFiles: 'https://example.org/worksheet.pdf, ftp://example.org/source.zip, not a url',
    }), { number: 787 });
    assert.equal(result.outputs.valid, 'false');
    let comment = await fs.readFile(result.outputs.validation_comment_path, 'utf8');
    assert.match(comment, /Additional files/);
    assert.match(comment, /ftp:\/\/example\.org\/source\.zip, not a url/);
    await fs.rm(result.tmp, { recursive: true, force: true });

    const slug = 'intake-test-zine-additional-files';
    created.add(slug);
    result = await run(body({
      title: 'Intake Test Zine Additional Files',
      additionalFiles: 'http://example.org/worksheet.pdf, https://example.org/source.zip',
    }), { number: 788 });
    assert.equal(result.outputs.valid, 'true');
    const submission = JSON.parse(await fs.readFile(path.join(DRAFTS, slug, 'submission.json'), 'utf8'));
    assert.deepEqual(submission.additional_files, [
      'http://example.org/worksheet.pdf',
      'https://example.org/source.zip',
    ]);
    await fs.rm(result.tmp, { recursive: true, force: true });
  });

  test('reports missing fields, bad links, and unchecked consents in one actionable comment', async () => {
    const { tmp, outputs } = await run(body({ title: '', readerUrl: 'ftp://example.org/file.pdf', printUrl: '', license: false, links: false }), { number: 782 });
    assert.equal(outputs.valid, 'false');
    const comment = await fs.readFile(outputs.validation_comment_path, 'utf8');
    assert.match(comment, /Title/); assert.match(comment, /Reader-order PDF URL/); assert.match(comment, /Print-ready PDF URL/);
    assert.match(comment, /License consent/); assert.match(comment, /Public and stable links/);
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
    assert.match(workflow, /branch: \$\{\{ needs\.process-new-zine\.outputs\.branch \}\}/);
    assert.match(processor, /automation\/new-zine-\$\{issueNumber\}/);
    assert.match(processor, /ZINE_RESERVED_DRAFT_SLUGS/);
    assert.match(workflow, /STATUS_COMMENT_MARKER: <!-- new-zine-intake-status -->/);
    assert.match(workflow, /pulls\.listFiles/);
    assert.match(workflow, /const existing = comments\.find/);
    assert.match(workflow, /issues\.updateComment/);
  });
});
