/**
 * Integration tests for process-new-event-issue.mjs
 *
 * These tests invoke the script's logic directly by importing the helpers
 * and simulating the script's main() flow against a real temp filesystem.
 *
 * The script itself cannot be imported (it has top-level await that reads
 * GITHUB_EVENT_PATH), so we test the observable outputs: files written to
 * a temp dir and the content of those files.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SCRIPT = new URL('./process-new-event-issue.mjs', import.meta.url).pathname;
const SCRIPTS_DIR = path.dirname(SCRIPT);

// Build a minimal GitHub issue event JSON
function makeEventPayload(body, { number = 1, login = 'testuser' } = {}) {
  return JSON.stringify({
    issue: {
      number,
      body,
      user: { login },
    },
  });
}

// Build a valid new-event issue body
function makeValidBody({
  eventName = 'PCD @ Test City',
  plusCode = '8FW4V75V+8Q',
  format = 'In person',
  primaryContactName = 'Jane Doe',
  contactEmail = 'jane@example.com',
  city = 'Test City',
  country = 'Testland',
  shortDescription = 'A short description.',
  fullDescription = 'A longer description.',
  eventPageUrl = '',
} = {}) {
  return [
    '### Event name',
    eventName,
    '',
    '### Map placement',
    plusCode,
    '',
    '### Event format',
    format,
    '',
    '### Primary contact name',
    primaryContactName,
    '',
    '### Primary contact email',
    contactEmail,
    '',
    '### City or locality',
    city,
    '',
    '### Country',
    country,
    '',
    '### Short description',
    shortDescription,
    '',
    '### Full event description',
    fullDescription,
    '',
    '### Event page URL',
    eventPageUrl,
    '',
    '### Event activities',
    '- [x] Live coding',
    '- [ ] Exhibition',
    '',
    '### Forum discussion URL',
    '_No response_',
    '',
    '### Organizers',
    'Jane Doe',
    '',
    '### Organization name',
    '_No response_',
    '',
    '### Organization website',
    '_No response_',
    '',
    '### Organization type',
    '_No response_',
    '',
    '### Street address of the event venue',
    '123 Main St',
    '',
    '### Date of the event',
    '_No response_',
    '',
    '### End date (for multi-day events)',
    '_No response_',
    '',
    '### Start time',
    '_No response_',
    '',
    '### End time',
    '_No response_',
    '',
    '### Event URL (only for online events)',
    '_No response_',
    '',
    '### Additional notes',
    '_No response_',
  ].join('\n');
}

async function runScript(issueBody, { tmpDir, eventsDir, number = 1, login = 'testuser' } = {}) {
  const eventPath = path.join(tmpDir, `event-${number}.json`);
  await fs.writeFile(eventPath, makeEventPayload(issueBody, { number, login }));

  const outputPath = path.join(tmpDir, `output-${number}.txt`);
  await fs.writeFile(outputPath, '');

  const env = {
    ...process.env,
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_OUTPUT: outputPath,
    RUNNER_TEMP: tmpDir,
    // Override WORKSPACE so event dirs are written to our test eventsDir
    // The script uses process.cwd() — we override by symlinking or by
    // setting the working directory for the child process.
  };

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    const result = await execFileAsync(process.execPath, [SCRIPT], {
      env,
      cwd: path.resolve(SCRIPTS_DIR, '../..'), // repo root
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (err) {
    stdout = err.stdout ?? '';
    stderr = err.stderr ?? '';
    exitCode = err.code ?? 1;
  }

  const outputContent = await fs.readFile(outputPath, 'utf8');
  const outputs = Object.fromEntries(
    outputContent.split('\n').filter(Boolean).map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
  );

  return { outputs, stdout, stderr, exitCode };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('process-new-event-issue', () => {
  let tmpDir;
  let eventsDir;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pni-test-'));
    // Create the events directory structure the script expects
    eventsDir = path.join(tmpDir, 'pcd-website', 'src', 'content', 'events');
    await fs.mkdir(eventsDir, { recursive: true });
    // Symlink into the real repo structure so the script can find plus-code.mjs
    // The script runs from repo root, events dir is resolved from cwd
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('valid new-event issue body produces metadata.json with uid', async () => {
    const { outputs } = await runScript(makeValidBody(), { tmpDir, eventsDir });
    assert.equal(outputs.valid, 'true');

    const eventId = 'pcd-test-city-2026';
    const metaPath = path.join(
      path.resolve(SCRIPTS_DIR, '../..'),
      'pcd-website/src/content/events',
      eventId,
      'metadata.json'
    );
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
      assert.equal(meta.id, eventId);
      assert.match(meta.uid, /^[0-9a-f]{7}$/);
      assert.equal(meta.event_name, 'PCD @ Test City');
    } finally {
      // Clean up the generated event dir
      await fs.rm(path.join(
        path.resolve(SCRIPTS_DIR, '../..'),
        'pcd-website/src/content/events',
        eventId
      ), { recursive: true, force: true });
    }
  });

  test('Event page URL field is read correctly (bug regression)', async () => {
    const body = makeValidBody({ eventPageUrl: 'https://example.com/my-event' });
    const eventId = 'pcd-test-city-2026';
    const metaPath = path.join(
      path.resolve(SCRIPTS_DIR, '../..'),
      'pcd-website/src/content/events',
      eventId,
      'metadata.json'
    );
    const { outputs } = await runScript(body, { tmpDir, eventsDir, number: 2 });
    assert.equal(outputs.valid, 'true');
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
      assert.equal(meta.event_page_url, 'https://example.com/my-event');
    } finally {
      await fs.rm(path.join(
        path.resolve(SCRIPTS_DIR, '../..'),
        'pcd-website/src/content/events',
        eventId
      ), { recursive: true, force: true });
    }
  });

  test('duplicate event directory causes valid=false', async () => {
    const eventId = 'pcd-test-city-2026';
    const dupDir = path.join(
      path.resolve(SCRIPTS_DIR, '../..'),
      'pcd-website/src/content/events',
      eventId
    );
    await fs.mkdir(dupDir, { recursive: true });
    try {
      const { outputs } = await runScript(makeValidBody(), { tmpDir, eventsDir, number: 3 });
      assert.equal(outputs.valid, 'false');
      // validation comment should mention the generated id
      const commentPath = outputs.validation_comment_path;
      const comment = await fs.readFile(commentPath, 'utf8');
      assert.ok(comment.includes(eventId), `Expected comment to mention ${eventId}`);
    } finally {
      await fs.rm(dupDir, { recursive: true, force: true });
    }
  });

  test('issue body with ### Event ID heading causes valid=skip', async () => {
    const body = makeValidBody() + '\n### Event ID\npcd-some-event-2026\n';
    const { outputs } = await runScript(body, { tmpDir, eventsDir, number: 4 });
    assert.equal(outputs.valid, 'skip');
  });

  test('issue body missing ### Map placement heading causes valid=skip', async () => {
    const body = '### Event name\nPCD @ Nowhere\n### Some other heading\nvalue\n';
    const { outputs } = await runScript(body, { tmpDir, eventsDir, number: 5 });
    assert.equal(outputs.valid, 'skip');
  });
});
