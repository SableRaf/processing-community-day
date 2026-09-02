import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import {
  allowedRedirectHost, fetchAttachment, formatFileSize, hasValidContent, isGitHubAttachmentUrl,
  normaliseFilename, parseSubmittedAttachments, resolveEmbeddedImageFilenames, validateAttachmentSelection, validateDownloadedFiles,
} from './zine-intake-helpers.mjs';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = path.join(ROOT, '.github/scripts/process-new-zine-issue.mjs');
const WORKFLOW = path.join(ROOT, '.github/workflows/new-zine-intake.yml');
const temporaryRoots = new Set();

const attachment = (name, url = `https://github.com/user-attachments/files/1/${encodeURIComponent(name)}`) => `[${name}](${url})`;
const bytes = (...values) => new Uint8Array(values);
const git = (cwd, ...args) => execFileAsync('git', args, { cwd });

function issueBody({
  title = 'Publication Ready Zine', reader = attachment('Reader.PDF'), print = attachment('Print.PDF'),
  cover = '', additional = '', maintainerNotes = '',
} = {}) {
  return [
    '### Title', title,
    '### Topic', 'Creative coding',
    '### Tags', 'beginner, p5.js',
    '### Language(s)', 'English, Spanish',
    '### Creator(s)', 'Guide Author',
    '### Creator URL', 'https://example.com/author',
    '### Short summary', 'A compact guide.',
    '### Full description', 'Make something together.',
    '### Reader-order PDF', reader,
    '### Print-ready PDF', print,
    '### Cover image', cover,
    '### Additional files', additional,
    '### Activity type', 'Workshop',
    '### Zine format', 'Single-sheet folded zine',
    '### Duration of the activity', '45 minutes',
    '### Materials', 'Paper and markers',
    '### Preferred attribution', 'Guide Author, CC BY-SA 4.0',
    '### Maintainer notes', maintainerNotes,
    '### License consent', '- [x] I own or have permission to license this material under CC BY-SA 4.0.',
  ].join('\n\n');
}

function parseOutputs(value) {
  return Object.fromEntries(value.trim().split('\n').filter(Boolean).map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

async function runProcessor(body, { number = 801, publishedOrders = [], env = {} } = {}) {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'pcd-zine-intake-'));
  temporaryRoots.add(workspace);
  const zines = path.join(workspace, 'pcd-website/src/content/zines');
  const runnerTemp = path.join(workspace, 'runner-temp');
  await fs.mkdir(zines, { recursive: true });
  await fs.mkdir(runnerTemp, { recursive: true });
  for (const [index, order] of publishedOrders.entries()) {
    const directory = path.join(zines, `existing-${index}`);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'index.md'), `---\nid: "existing-${index}"\norder: ${order}\n---\n`);
  }

  const eventPath = path.join(workspace, 'event.json');
  const outputPath = path.join(workspace, 'output.txt');
  const fetchMockPath = path.join(workspace, 'mock-fetch.mjs');
  await fs.writeFile(eventPath, JSON.stringify({
    issue: { number, body, html_url: `https://github.com/processing/processing-community-day/issues/${number}`, user: { login: 'submitter' } },
    repository: { full_name: 'processing/processing-community-day' },
  }));
  await fs.writeFile(outputPath, '');
  await fs.writeFile(fetchMockPath, `
    const encoder = new TextEncoder();
    globalThis.fetch = async (input) => {
      const filename = decodeURIComponent(new URL(input).pathname.split('/').pop()).toLowerCase();
      let body;
      if (filename.endsWith('.pdf')) body = encoder.encode('%PDF-1.7');
      else if (filename.endsWith('.zip')) body = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
      else if (filename.endsWith('.png') || filename === 'embedded-cover') body = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      else if (/\\.jpe?g$/.test(filename)) body = new Uint8Array([0xff, 0xd8, 0xff]);
      else if (filename.endsWith('.webp')) body = encoder.encode('RIFFxxxxWEBP');
      else if (filename.endsWith('.json')) body = encoder.encode('{"fixture":true}');
      else body = encoder.encode('fixture text');
      return new Response(body, { status: 200 });
    };
  `);

  await execFileAsync(process.execPath, ['--import', pathToFileURL(fetchMockPath).href, SCRIPT], {
    cwd: workspace,
    env: {
      ...process.env,
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_OUTPUT: outputPath,
      RUNNER_TEMP: runnerTemp,
      ZINE_RESERVED_SLUGS: '',
      ZINE_OPEN_PR_ORDERS: '',
      ZINE_CURRENT_SLUG: '',
      ZINE_CURRENT_ORDER: '',
      ...env,
    },
  });
  return { workspace, zines, outputs: parseOutputs(await fs.readFile(outputPath, 'utf8')) };
}

afterEach(async () => {
  await Promise.all([...temporaryRoots].map((directory) => fs.rm(directory, { recursive: true, force: true })));
  temporaryRoots.clear();
});

describe('new-zine attachment helpers', () => {
  test('accepts only direct GitHub attachments and normalizes safe filenames', () => {
    assert.equal(isGitHubAttachmentUrl('https://github.com/user-attachments/files/1/a.pdf'), true);
    assert.equal(isGitHubAttachmentUrl('https://example.com/a.pdf'), false);
    const uploaded = '[My Guide.PDF](https://github.com/user-attachments/files/1/my-guide.pdf)';
    assert.deepEqual(parseSubmittedAttachments(`${uploaded}\n${uploaded}`), { attachments: [{ filename: 'My Guide.PDF', url: 'https://github.com/user-attachments/files/1/my-guide.pdf' }], invalidEntries: [] });
    assert.equal(normaliseFilename('My Guide.PDF'), 'My Guide.pdf');
    assert.equal(normaliseFilename('../secret.pdf'), null);
    assert.equal(normaliseFilename('metadata.json'), 'metadata.json');
    assert.equal(normaliseFilename('index.md'), 'index.md');
    assert.equal(normaliseFilename('readme.md'), 'readme.md');
    assert.equal(normaliseFilename('nul.txt'), null);
    assert.equal(normaliseFilename('COM9.pdf'), null);
    assert.equal(normaliseFilename('lpt10.txt'), 'lpt10.txt');
    assert.equal(normaliseFilename('bad\u0000.pdf'), null);
  });

  test('accepts GitHub HTML image embeds and derives their missing filenames from content', () => {
    const url = 'https://github.com/user-attachments/assets/b4e4171c-0c05-44d3-afee-923acce095a4';
    const html = `<img width="854" height="1280" alt="Image" src="${url}" />`;
    const parsed = parseSubmittedAttachments(html);
    assert.deepEqual(parsed, { attachments: [{ filename: 'image', url, embeddedImage: true }], invalidEntries: [] });
    const files = [{ ...parsed.attachments[0], field: 'Cover image', kind: 'cover', bytes: bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) }];
    assert.deepEqual(validateAttachmentSelection(files, { allowUnresolvedImages: true }), []);
    resolveEmbeddedImageFilenames(files);
    assert.equal(files[0].filename, 'cover.png');
    assert.deepEqual(validateAttachmentSelection(files), []);
  });

  test('scopes collisions to storage namespaces and enforces formats and file count', () => {
    const files = [
      { filename: 'cover.PNG', field: 'Cover image', kind: 'cover' },
      { filename: 'cover.png', field: 'Additional files', kind: 'download' },
      { filename: 'COVER.PNG', field: 'Additional files', kind: 'download' },
      ...Array.from({ length: 8 }, (_, index) => ({ filename: `file-${index}.exe`, field: 'Additional files', kind: 'download' })),
    ];
    const errors = validateAttachmentSelection(files);
    assert.equal(errors.filter((error) => /unique/.test(error.message)).length, 1);
    assert.match(errors.map((error) => error.message).join(' '), /no more than 10/);
    assert.match(errors.map((error) => error.message).join(' '), /Supported downloads/);
  });

  test('checks binary signatures and UTF-8/JSON content independently of MIME', () => {
    assert.equal(hasValidContent('guide.pdf', new TextEncoder().encode('%PDF-1.7')), true);
    assert.equal(hasValidContent('archive.zip', bytes(0x50, 0x4b, 0x03, 0x04)), true);
    assert.equal(hasValidContent('cover.png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), true);
    assert.equal(hasValidContent('cover.jpg', bytes(0xff, 0xd8, 0xff)), true);
    assert.equal(hasValidContent('cover.jpeg', bytes(0xff, 0xd8, 0xff)), true);
    assert.equal(hasValidContent('cover.webp', new TextEncoder().encode('RIFFxxxxWEBP')), true);
    assert.equal(hasValidContent('notes.md', new TextEncoder().encode('hello')), true);
    assert.equal(hasValidContent('table.csv', new TextEncoder().encode('a,b')), true);
    assert.equal(hasValidContent('data.json', new TextEncoder().encode('{"ok":true}')), true);
    assert.equal(hasValidContent('data.json', new TextEncoder().encode('{bad')), false);
    assert.equal(hasValidContent('notes.txt', bytes(0x68, 0x00)), false);
    assert.equal(hasValidContent('notes.txt', bytes(0xc3, 0x28)), false);
  });

  test('uses decimal file sizes without crossing a rounded unit boundary', () => {
    assert.equal(formatFileSize(311_000), '311 kB');
    assert.equal(formatFileSize(999_949), '999.9 kB');
    assert.equal(formatFileSize(999_950), '1 MB');
    assert.equal(formatFileSize(1_200_000), '1.2 MB');
    const tooLargeCover = { filename: 'cover.png', field: 'Cover image', kind: 'cover', bytes: new Uint8Array(10_000_001) };
    assert.match(validateDownloadedFiles([tooLargeCover]).map((error) => error.message).join(' '), /Resize or compress the cover/);
  });

  test('follows only approved HTTPS redirects and stops after five hops', async () => {
    for (const host of ['objects.githubusercontent.com', 'github-cloud.s3.amazonaws.com', 'github-production-user-asset-abc.s3.amazonaws.com', 'github-production-repository-file-123.s3.amazonaws.com']) assert.equal(allowedRedirectHost(host), true);
    assert.equal(allowedRedirectHost('evil.example'), false);
    let calls = 0;
    const fiveRedirects = async () => {
      calls += 1;
      return calls <= 5
        ? new Response(null, { status: 302, headers: { location: `https://objects.githubusercontent.com/file?hop=${calls}` } })
        : new Response(bytes(0x25, 0x50, 0x44, 0x46, 0x2d), { status: 200 });
    };
    assert.deepEqual(await fetchAttachment('https://github.com/user-attachments/files/1/guide.pdf', fiveRedirects), bytes(0x25, 0x50, 0x44, 0x46, 0x2d));
    assert.equal(calls, 6);
    await assert.rejects(fetchAttachment('https://github.com/user-attachments/files/1/guide.pdf', async () => new Response(null, { status: 302, headers: { location: 'https://objects.githubusercontent.com/file' } })), /more than five times/);
    await assert.rejects(fetchAttachment('https://example.com/guide.pdf', fiveRedirects), /direct GitHub file attachments/);
    await assert.rejects(fetchAttachment('https://github.com/user-attachments/files/1/guide.pdf', async () => new Response(null, { status: 302, headers: { location: 'https://evil.example/file' } })), /unapproved host/);
  });
});

describe('process-new-zine-issue', () => {
  test('writes publication-ready output, preserves namespaces, metadata, order, and maintainer notes', async () => {
    const result = await runProcessor(issueBody({
      cover: attachment('cover.JPEG', 'https://github.com/user-attachments/files/1/root-cover.jpeg'),
      additional: [
        attachment('cover.jpeg', 'https://github.com/user-attachments/files/2/download-cover.jpeg'),
        attachment('metadata.json', 'https://github.com/user-attachments/files/3/metadata.json'),
      ].join('\n'),
      maintainerNotes: 'Check the fold before merging.',
    }), { publishedOrders: [2, 4], env: { ZINE_OPEN_PR_ORDERS: '7,6' } });

    assert.equal(result.outputs.valid, 'true');
    assert.equal(result.outputs.branch, 'automation/new-zine-801');
    const directory = path.join(result.zines, 'publication-ready-zine');
    const metadata = JSON.parse(await fs.readFile(path.join(directory, 'metadata.json'), 'utf8'));
    assert.deepEqual(metadata.downloads.map(({ file, role }) => [file, role]), [
      ['Reader.pdf', 'reader-order'],
      ['Print.pdf', 'print-ready'],
      ['cover.jpeg', undefined],
      ['metadata.json', undefined],
    ]);
    assert.deepEqual(metadata.cover, { src: 'cover.jpeg', alt: 'Publication Ready Zine' });
    assert.deepEqual(metadata.tags, ['beginner', 'p5.js']);
    assert.deepEqual(metadata.languages, ['English', 'Spanish']);
    assert.equal(metadata.created_by_url, 'https://example.com/author');
    assert.equal(metadata.activity_type, 'Workshop');
    assert.equal(metadata.zine_format, 'Single-sheet folded zine');
    assert.equal(metadata.duration, '45 minutes');
    assert.equal(metadata.materials, 'Paper and markers');
    assert.equal(metadata.attribution, 'Guide Author, CC BY-SA 4.0');
    assert.equal(metadata.source_url, 'https://github.com/processing/processing-community-day/issues/801');
    assert.match(await fs.readFile(path.join(directory, 'index.md'), 'utf8'), /^order: 8$/m);
    for (const file of ['Reader.pdf', 'Print.pdf', 'cover.jpeg', 'metadata.json']) await fs.access(path.join(directory, 'downloads', file));
    await fs.access(path.join(directory, 'cover.jpeg'));
    assert.match(await fs.readFile(result.outputs.pr_body_path, 'utf8'), /### Maintainer notes\n\nCheck the fold before merging\./);
  });

  test('publishes a cover pasted as GitHub HTML image markup', async () => {
    const coverUrl = 'https://github.com/user-attachments/assets/embedded-cover';
    const result = await runProcessor(issueBody({ cover: `<img width="854" height="1280" alt="Image" src="${coverUrl}" />` }));
    assert.equal(result.outputs.valid, 'true');
    const directory = path.join(result.zines, 'publication-ready-zine');
    const metadata = JSON.parse(await fs.readFile(path.join(directory, 'metadata.json'), 'utf8'));
    assert.deepEqual(metadata.cover, { src: 'cover.png', alt: 'Publication Ready Zine' });
    await fs.access(path.join(directory, 'cover.png'));
  });

  test('reuses a valid current order of zero', async () => {
    const result = await runProcessor(issueBody({ title: 'Zero Order Zine' }), { env: { ZINE_CURRENT_ORDER: '0', ZINE_OPEN_PR_ORDERS: '9' } });
    assert.equal(result.outputs.valid, 'true');
    assert.match(await fs.readFile(path.join(result.zines, 'zero-order-zine/index.md'), 'utf8'), /^order: 0$/m);
  });

  test('rejects reserved and published slugs while allowing the current slug', async () => {
    let result = await runProcessor(issueBody({ title: 'Reserved Zine' }), { env: { ZINE_RESERVED_SLUGS: 'reserved-zine' } });
    assert.equal(result.outputs.valid, 'false');
    assert.match(await fs.readFile(result.outputs.validation_comment_path, 'utf8'), /already staged by another open zine review PR/);

    result = await runProcessor(issueBody({ title: 'Existing 0' }), { publishedOrders: [3] });
    assert.equal(result.outputs.valid, 'false');

    result = await runProcessor(issueBody({ title: 'Existing 0' }), { publishedOrders: [3], env: { ZINE_CURRENT_SLUG: 'existing-0', ZINE_CURRENT_ORDER: '3' } });
    assert.equal(result.outputs.valid, 'true');
  });

  test('skips unrelated issue templates', async () => {
    const result = await runProcessor('### Title\n\nNot a zine');
    assert.equal(result.outputs.valid, 'skip');
  });

  test('reports an external attachment in its issue field with actionable guidance', async () => {
    const result = await runProcessor(issueBody({ reader: '[Reader.pdf](https://example.com/reader.pdf)' }));
    assert.equal(result.outputs.valid, 'false');
    const comment = await fs.readFile(result.outputs.validation_comment_path, 'utf8');
    assert.match(comment, /Reader-order PDF/);
    assert.match(comment, /download the source file and attach it here/);
  });

  test('authoritative branch rebuilding drops an obsolete slug and renamed download', async () => {
    const repository = await fs.mkdtemp(path.join(os.tmpdir(), 'pcd-zine-branch-'));
    temporaryRoots.add(repository);
    await git(repository, 'init');
    await git(repository, 'config', 'user.name', 'Test Bot');
    await git(repository, 'config', 'user.email', 'test@example.com');
    await git(repository, 'config', 'commit.gpgsign', 'false');
    await fs.writeFile(path.join(repository, 'README.md'), 'base\n');
    await git(repository, 'add', 'README.md');
    await git(repository, 'commit', '-m', 'base');
    const defaultBranch = (await git(repository, 'branch', '--show-current')).stdout.trim();
    await git(repository, 'switch', '-c', 'automation/new-zine-801');
    const oldDownload = path.join(repository, 'pcd-website/src/content/zines/old-zine/downloads/old.pdf');
    await fs.mkdir(path.dirname(oldDownload), { recursive: true });
    await fs.writeFile(oldDownload, '%PDF-old');
    await git(repository, 'add', 'pcd-website/src/content/zines');
    await git(repository, 'commit', '-m', 'old generated zine');

    await git(repository, 'switch', defaultBranch);
    const newDownload = path.join(repository, 'pcd-website/src/content/zines/new-zine/downloads/new.pdf');
    await fs.mkdir(path.dirname(newDownload), { recursive: true });
    await fs.writeFile(newDownload, '%PDF-new');
    await git(repository, 'switch', '-C', 'automation/new-zine-801');
    await git(repository, 'add', 'pcd-website/src/content/zines');
    await git(repository, 'commit', '-m', 'new generated zine');

    const tree = (await git(repository, 'ls-tree', '-r', '--name-only', 'HEAD')).stdout;
    assert.match(tree, /pcd-website\/src\/content\/zines\/new-zine\/downloads\/new\.pdf/);
    assert.doesNotMatch(tree, /old-zine|old\.pdf/);
  });

  test('workflow discovers other PR orders and transitions needs-changes labels', async () => {
    const workflow = await fs.readFile(WORKFLOW, 'utf8');
    assert.match(workflow, /pull\.head\.repo\?\.full_name === `\$\{owner\}\/\$\{repo\}`/);
    assert.match(workflow, /else orders\.push\(orderMatch\[1\]\)/);
    assert.match(workflow, /core\.setOutput\('current_pr_number'/);
    assert.match(workflow, /name: 'needs changes'/);
    assert.match(workflow, /issues\.removeLabel[\s\S]+name: 'needs review'/);
    assert.match(workflow, /issues\.removeLabel[\s\S]+name: 'needs changes'/);
    assert.match(workflow, /git switch -C "\$BRANCH"[\s\S]+git add pcd-website\/src\/content\/zines[\s\S]+git push --force-with-lease/);
  });
});
