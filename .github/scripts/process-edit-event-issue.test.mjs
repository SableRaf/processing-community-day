/**
 * Integration tests for process-edit-event-issue.mjs
 */
import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SCRIPT = new URL('./process-edit-event-issue.mjs', import.meta.url).pathname;
const SCRIPTS_DIR = path.dirname(SCRIPT);
const REPO_ROOT = path.resolve(SCRIPTS_DIR, '../..');
const EVENTS_DIR = path.join(REPO_ROOT, 'pcd-website/src/content/events');

const TEST_EVENT_ID = 'pcd-edit-test-city-2026';
const TEST_EVENT_DIR = path.join(EVENTS_DIR, TEST_EVENT_ID);

const EXISTING_META = {
  id: TEST_EVENT_ID,
  uid: 'abc1234',
  organizers: [{ name: 'Old Organizer' }],
  primary_contact: { name: 'Old Contact', email: 'old@example.com' },
  organization_name: 'Old Org',
  organization_url: '',
  organization_type: '',
  online_event: false,
  event_url: '',
  event_name: 'PCD @ Edit Test City',
  event_location: { address: '123 Old St', plus_code: '8FW4V75V+8Q' },
  event_date: '2026-10-01',
  event_start_time: '14:00',
  event_end_time: '18:00',
  event_short_description: 'Old short description.',
  event_activities: ['Show-and-tell', 'Exhibition'],
  event_page_url: '',
  forum_thread_url: '',
  city: 'Edit Test City',
  country: 'Testland',
  placeholder: false,
  intake: { issue_number: 99, submitted_by_github: 'olduser', submitted_date: '2026-01-01', maintainer_notes: '' },
};

const EXISTING_CONTENT = `---\nid: ${TEST_EVENT_ID}\n---\n\nOld content here.\n`;

function makeEventPayload(body, { number = 10, login = 'edituser' } = {}) {
  return JSON.stringify({
    issue: { number, body, user: { login } },
  });
}

function makeValidEditBody({
  eventId = TEST_EVENT_ID,
  eventName = 'PCD @ Edit Test City',
  plusCode = '8FW4V75V+8Q',
  format = 'In person',
  primaryContactName = 'New Contact',
  contactEmail = 'new@example.com',
  city = 'Edit Test City',
  country = 'Testland',
  shortDescription = 'Updated short description.',
  fullDescription = 'Updated full description.',
  forumThreadUrl = 'https://discourse.processing.org/t/pcd-worldwide-2026-call-for-organizers/48081',
  activities = '- [x] Live coding\n- [ ] Exhibition\n',
} = {}) {
  return [
    '### Event ID',
    eventId,
    '',
    '### Event name',
    eventName,
    '',
    '### Forum discussion URL',
    forumThreadUrl,
    '',
    '### Map placement',
    plusCode,
    '',
    '### Event format',
    format,
    '',
    '### Event URL (only for online events)',
    '_No response_',
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
    '456 New St',
    '',
    '### Date of the event',
    '2026-10-17',
    '',
    '### End date (for multi-day events)',
    '_No response_',
    '',
    '### Start time',
    '19:00',
    '',
    '### End time',
    '21:30',
    '',
    '### Event page URL',
    '_No response_',
    '',
    '### Organizers',
    'New Organizer',
    '',
    '### Short description',
    shortDescription,
    '',
    '### Full event description',
    fullDescription,
    '',
    '### Event activities',
    activities,
    '',
    '### Additional notes',
    '_No response_',
  ].join('\n');
}

async function runScript(issueBody, { tmpDir, number = 10, login = 'edituser' } = {}) {
  const eventPath = path.join(tmpDir, `event-${number}.json`);
  await fs.writeFile(eventPath, makeEventPayload(issueBody, { number, login }));

  const outputPath = path.join(tmpDir, `output-${number}.txt`);
  await fs.writeFile(outputPath, '');

  const env = {
    ...process.env,
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_OUTPUT: outputPath,
    RUNNER_TEMP: tmpDir,
  };

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    const result = await execFileAsync(process.execPath, [SCRIPT], {
      env,
      cwd: REPO_ROOT,
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

describe('process-edit-event-issue', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pei-test-'));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Set up a test event directory with existing metadata and content
    await fs.mkdir(TEST_EVENT_DIR, { recursive: true });
    await fs.writeFile(path.join(TEST_EVENT_DIR, 'metadata.json'), JSON.stringify(EXISTING_META, null, 2) + '\n');
    await fs.writeFile(path.join(TEST_EVENT_DIR, 'content.md'), EXISTING_CONTENT);
  });

  afterEach(async () => {
    await fs.rm(TEST_EVENT_DIR, { recursive: true, force: true });
  });

  test('valid edit issue updates metadata.json and preserves uid and intake', async () => {
    const { outputs } = await runScript(makeValidEditBody(), { tmpDir });
    assert.equal(outputs.valid, 'true');
    assert.equal(outputs.pr_label, 'edit event');
    assert.equal(outputs.action_verb, 'updated on');

    const meta = JSON.parse(await fs.readFile(path.join(TEST_EVENT_DIR, 'metadata.json'), 'utf8'));
    assert.equal(meta.uid, 'abc1234', 'uid must be preserved');
    assert.equal(meta.intake.issue_number, 99, 'intake must be preserved');
    assert.equal(meta.primary_contact.name, 'New Contact');
    assert.equal(meta.event_name, 'PCD @ Edit Test City');
  });

  test('blank full_description leaves existing content.md unchanged', async () => {
    const body = makeValidEditBody({ fullDescription: '' });
    const { outputs } = await runScript(body, { tmpDir, number: 11 });
    assert.equal(outputs.valid, 'true');

    const content = await fs.readFile(path.join(TEST_EVENT_DIR, 'content.md'), 'utf8');
    assert.equal(content, EXISTING_CONTENT, 'content.md should be unchanged when full_description is blank');
  });

  test('all activities unchecked preserves existing event_activities', async () => {
    const body = makeValidEditBody({ activities: '- [ ] Live coding\n- [ ] Exhibition\n' });
    const { outputs } = await runScript(body, { tmpDir, number: 12 });
    assert.equal(outputs.valid, 'true');

    const meta = JSON.parse(await fs.readFile(path.join(TEST_EVENT_DIR, 'metadata.json'), 'utf8'));
    assert.deepEqual(meta.event_activities, ['Show-and-tell', 'Exhibition'], 'existing activities must be preserved');
  });

  test('some activities checked overwrites event_activities', async () => {
    const body = makeValidEditBody({ activities: '- [x] Live coding\n- [ ] Exhibition\n' });
    const { outputs } = await runScript(body, { tmpDir, number: 13 });
    assert.equal(outputs.valid, 'true');

    const meta = JSON.parse(await fs.readFile(path.join(TEST_EVENT_DIR, 'metadata.json'), 'utf8'));
    assert.deepEqual(meta.event_activities, ['Live coding']);
  });

  test('event directory does not exist causes valid=false', async () => {
    await fs.rm(TEST_EVENT_DIR, { recursive: true, force: true });
    const { outputs } = await runScript(makeValidEditBody(), { tmpDir, number: 14 });
    assert.equal(outputs.valid, 'false');

    const commentPath = outputs.validation_comment_path;
    const comment = await fs.readFile(commentPath, 'utf8');
    assert.ok(comment.includes(TEST_EVENT_ID), 'validation comment should mention the missing event id');
  });

  test('missing ### Event ID heading causes valid=skip', async () => {
    const body = '### Event name\nPCD @ Test\n### Map placement\n8FW4V75V+8Q\n';
    const { outputs } = await runScript(body, { tmpDir, number: 15 });
    assert.equal(outputs.valid, 'skip');
  });
});
