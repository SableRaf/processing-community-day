import fs from 'node:fs/promises';
import path from 'node:path';
import { resolvePlusCode } from './plus-code.mjs';

const WORKSPACE = process.cwd();
const RUNNER_TEMP = process.env.RUNNER_TEMP ?? path.join(WORKSPACE, '.tmp');
const OUTPUT_PATH = process.env.GITHUB_OUTPUT;
const EVENT_PATH = process.env.GITHUB_EVENT_PATH;
const YEAR = '2026';
const PCD_FORUM_THREAD_URL = 'https://discourse.processing.org/t/pcd-worldwide-2026-call-for-organizers/48081';
const PCD_CONTACT_EMAIL = 'day@processingfoundation.org';

await fs.mkdir(RUNNER_TEMP, { recursive: true });

const eventPayload = JSON.parse(await fs.readFile(EVENT_PATH, 'utf8'));
const issue = eventPayload.issue;
const issueNumber = issue.number;
const issueBody = issue.body ?? '';
const submitterLogin = issue.user?.login ?? '';

async function setOutput(key, value) {
  if (!OUTPUT_PATH) return;
  await fs.appendFile(OUTPUT_PATH, `${key}=${String(value)}\n`);
}

function parseIssueSections(body) {
  const normalized = body.replace(/\r/g, '');
  const sections = normalized.split(/^### /m).slice(1);
  return new Map(sections.map((section) => {
    const newlineIndex = section.indexOf('\n');
    const label = (newlineIndex === -1 ? section : section.slice(0, newlineIndex)).trim();
    const value = newlineIndex === -1 ? '' : section.slice(newlineIndex + 1);
    const cleaned = value.trim().replace(/^_No response_\s*$/m, '').trim();
    return [label, cleaned];
  }));
}

function required(fields, label, errors, errorOverride) {
  const value = fields.get(label)?.trim() ?? '';
  if (!value) errors.push(errorOverride ?? { field: label, message: 'This field is required.' });
  return value;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function isValidTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function parseActivities(raw) {
  const VALID_ACTIVITIES = new Set([
    'Show-and-tell', 'Hands-on workshops', 'Live coding', 'Exhibition',
    'Panel discussions', 'Beginner introductions to Processing or p5.js',
    'Creative coding jams or hack sessions', 'Student project presentations',
    'Screening', 'Other',
  ]);
  return raw
    .split('\n')
    .filter(line => /^\s*-\s*\[x\]/i.test(line))
    .map(line => line.replace(/^\s*-\s*\[x\]\s*/i, '').trim())
    .filter(label => VALID_ACTIVITIES.has(label));
}

function parseOrganizers(raw) {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  return lines.map((line) => {
    // Strip optional "<email>" suffix if someone provides it, but don't require it
    const match = line.match(/^(.*?)\s*<[^>]+>$/);
    const name = (match ? match[1] : line).trim();
    return { name };
  }).filter((organizer) => organizer.name);
}

function formatError({ field, found, message }) {
  const foundPart = found !== undefined ? ` (found: \`${found}\`)` : '';
  return `- **${field}**${foundPart} — ${message}`;
}

function buildValidationComment(errors) {
  const count = errors.length;
  const fieldWord = count === 1 ? 'field needs' : 'fields need';
  return [
    'Thanks for submitting your event to Processing Community Day 2026! 🌍',
    '',
    `We couldn't create a pull request yet because **${count} ${fieldWord} attention**:`,
    '',
    ...errors.map(formatError),
    '',
    `Please edit and save the issue with the corrected information, this check will run again automatically. `,
    '',
    `If you need help, please ask in the [PCD 2026 forum thread](${PCD_FORUM_THREAD_URL}) (recommended) or write to (${PCD_CONTACT_EMAIL}).`,
  ].join('\n');
}

function buildPrBody(number, name, submitterLogin, isOnlineEvent, eventDate, startTime, address, plusCodeNote, rawPlusCode, resolvedPlusCode, shortDescription, fullDescription, contactName, contactEmail) {
  const submitterMention = submitterLogin ? `@${submitterLogin}` : 'the submitter';
  const locationLine = isOnlineEvent
    ? '- [ ] Online event URL is correct and accessible'
    : address
      ? '- [ ] Venue address and map pin placement are correct'
      : '- [ ] Location is marked TBD — confirm this is intentional';
  const dateLine = eventDate
    ? startTime
      ? '- [ ] Date and time are correct'
      : '- [ ] Date is correct; time is marked TBD — confirm this is intentional'
    : '- [ ] Date is marked TBD — confirm this is intentional';

  const noteBlock = plusCodeNote
    ? [
        '> [!NOTE]',
        `> The Plus Code was auto-recovered from the user's input (\`${rawPlusCode}\`) using the city as a reference. Please verify the map pin placement is correct (https://plus.codes/${resolvedPlusCode}).`,
        '',
      ]
    : [];

  return [
    ...noteBlock,
    `Closes #${number}`,
    '',
    `This PR was generated from the "New Event" issue form for **${name}**.`,
    `Submitted by ${submitterMention}.`,
    '',
    'Review checklist:',
    `- [ ] Event name "${name}" is correct`,
    `- [ ] Public contact info "${contactName} <${contactEmail}>" is correct`,
    ...(shortDescription ? [] : ['- [ ] Short description is left blank — confirm this is intentional']),
    ...(fullDescription ? [] : ['- [ ] Long description is left blank — confirm this is intentional']),
    dateLine,
    locationLine,
    '- [ ] Check the map and event details page in the **Netlify preview** (link posted below by the Netlify bot)',
  ].join('\n');
}

console.log(`[process-new-event-issue] issue #${issueNumber}, body length: ${issueBody.length}`);

// GitHub strips HTML comments from markdown blocks, so we detect the template
// by checking for a heading that is unique to the new-event issue form.
if (!issueBody.includes('### Map placement')) {
  console.log('[process-new-event-issue] template headings not found — skipping (not a new event issue)');
  await setOutput('valid', 'skip');
  process.exit(0);
}

async function main() {
  const fields = parseIssueSections(issueBody);
  const errors = [];

  const eventName = required(fields, 'Event name', errors);
  const rawPlusCode = required(fields, 'Map placement', errors, {
    field: 'Map placement (Plus Code)',
    message: 'This field is required. A Plus Code looks like `8FW4V75V+8Q`. [Find your Plus Code →](https://plus.codes/)',
  });
  const eventFormat = required(fields, 'Event format', errors, {
    field: 'Event format',
    message: 'This field is required. Choose one of: `In person` or `Online`.',
  });
  const isOnlineEvent = eventFormat === 'Online';
  const eventUrl = fields.get('Event URL (only for online events)')?.trim() ?? '';
  const primaryContactName = required(fields, 'Primary contact name', errors);
  const contactEmail = required(fields, 'Primary contact email', errors);
  // Parse city/country before plus_code resolution — needed for short-code recovery
  const city = fields.get('City or locality')?.trim() ?? '';
  const country = fields.get('Country')?.trim() ?? '';
  const organizationName = fields.get('Organization name')?.trim() ?? '';
  const organizationUrl = fields.get('Organization website')?.trim() ?? '';
  const organizationType = (fields.get('Organization type')?.trim() ?? '').replace(/^None$/i, '');
  const address = fields.get('Street address of the event venue')?.trim() ?? '';
  const eventDate = fields.get('Date of the event')?.trim() ?? '';
  const eventEndDate = fields.get('End date (for multi-day events)')?.trim() ?? '';
  const startTime = fields.get('Start time')?.trim() ?? '';
  const endTime = fields.get('End time')?.trim() ?? '';
  const eventWebsite = fields.get('Event website')?.trim() ?? '';
  const organizers = parseOrganizers(fields.get('Organizers')?.trim() ?? '');
  const shortDescription = fields.get('Short description')?.trim() ?? '';
  const fullDescription = fields.get('Full event description')?.trim() ?? '';
  const activities = parseActivities(fields.get('Event activities')?.trim() ?? '');
  const forumThreadUrl = fields.get('Forum discussion URL')?.trim() ?? '';
  const maintainerNotes = fields.get('Additional notes')?.trim() ?? '';

  // Resolve plus_code with smart recovery before validation
  const { code: resolvedPlusCode, note: plusCodeNote } = await resolvePlusCode(rawPlusCode, city, country);
  const plusCode = resolvedPlusCode ?? rawPlusCode.replace(/\s+/g, '').toUpperCase();
  if (plusCodeNote) {
    console.log(`[process-new-event-issue] plus_code auto-recovered: ${rawPlusCode} → ${plusCode}`);
  }

  const VALID_ORG_TYPES = new Set([
    'School, university, library',
    'Fablab, makerspace, hackerspace',
    'Museum, gallery, media arts center',
    'Meetup, code club, community group',
    'Nonprofit, foundation, association',
    'Studio, tech company, startup',
    'Other',
  ]);
  const VALID_EVENT_FORMATS = new Set(['In person', 'Online']);

  if (eventDate && !isValidDate(eventDate)) errors.push({ field: 'Event date', found: eventDate, message: 'Invalid format. Please use `YYYY-MM-DD`, e.g. `2026-03-21`.' });
  if (eventEndDate && !isValidDate(eventEndDate)) errors.push({ field: 'End date', found: eventEndDate, message: 'Invalid format. Please use `YYYY-MM-DD`, e.g. `2026-03-22`.' });
  if (isValidDate(eventDate) && eventEndDate && isValidDate(eventEndDate) && eventEndDate < eventDate) errors.push({ field: 'End date', found: eventEndDate, message: 'The end date must be on or after the event date.' });
  if (startTime && !isValidTime(startTime)) errors.push({ field: 'Start time', found: startTime, message: 'Invalid format. Please use 24-hour `HH:MM`, e.g. `14:00`.' });
  if (endTime && !isValidTime(endTime)) errors.push({ field: 'End time', found: endTime, message: 'Invalid format. Please use 24-hour `HH:MM`, e.g. `16:30`.' });
  if (
    startTime &&
    endTime &&
    isValidTime(startTime) &&
    isValidTime(endTime) &&
    (!eventEndDate || eventEndDate === eventDate) &&
    endTime <= startTime
  ) {
    errors.push({ field: 'End time', found: endTime, message: 'End time must be later than start time for single-day events.' });
  }
  if (eventWebsite && !isValidHttpUrl(eventWebsite)) errors.push({ field: 'Event website', found: eventWebsite, message: 'Must be a valid URL starting with `http://` or `https://`, e.g. `https://example.com/pcd`.' });
  if (forumThreadUrl && !isValidHttpUrl(forumThreadUrl)) errors.push({ field: 'Forum discussion URL', found: forumThreadUrl, message: 'Must be a valid URL starting with `http://` or `https://`.' });
  if (contactEmail && !isValidEmail(contactEmail)) errors.push({ field: 'Primary contact email', found: contactEmail, message: 'Not a valid email address. Please provide a valid email like `you@example.com`.' });
  if (rawPlusCode && !resolvedPlusCode) errors.push({ field: 'Map placement (Plus Code)', found: rawPlusCode.replace(/\s+/g, '').toUpperCase(), message: 'Not a valid full global Plus Code. It should look like `8FW4V75V+8Q`. [Find your Plus Code →](https://plus.codes/)' });
  if (eventUrl && !isValidHttpUrl(eventUrl)) errors.push({ field: 'Event URL', found: eventUrl, message: 'Must be a valid URL starting with `http://` or `https://`.' });
  if (organizationUrl && !isValidHttpUrl(organizationUrl)) errors.push({ field: 'Organization website', found: organizationUrl, message: 'Must be a valid URL starting with `http://` or `https://`.' });
  if (eventFormat && !VALID_EVENT_FORMATS.has(eventFormat)) errors.push({ field: 'Event format', found: eventFormat, message: 'Not a recognized option. Please choose one of: `In person` or `Online`.' });
  if (organizationType && !VALID_ORG_TYPES.has(organizationType)) errors.push({ field: 'Organization type', found: organizationType, message: 'Not a recognized option. Please choose one of the valid options from the form.' });
  if (isOnlineEvent && !eventUrl) errors.push({ field: 'Event URL', message: 'An event URL is required for online events. Please provide the URL where people can join.' });

  const normalizedEventName = slugify(eventName);
  const eventId = normalizedEventName.startsWith('pcd-')
    ? `${normalizedEventName}-${YEAR}`
    : `pcd-${normalizedEventName}-${YEAR}`;

  const eventDirPath = path.join(WORKSPACE, 'pcd-website/src/content/events', eventId);
  const markdownPath = path.join(eventDirPath, 'content.md');
  const metadataPath = path.join(eventDirPath, 'metadata.json');

  try {
    await fs.access(eventDirPath);
    errors.push({ field: 'Event name', found: eventName, message: `An event with the generated ID \`${eventId}\` already exists. If you need to update an existing event, post in the [PCD 2026 forum thread](${PCD_FORUM_THREAD_URL}) (recommended) or write to ${PCD_CONTACT_EMAIL}.` });
  } catch {
    // Directory does not exist yet.
  }

  if (errors.length > 0) {
    console.log(`[process-new-event-issue] validation failed with ${errors.length} error(s):`);
    errors.forEach((e) => console.log(`  - [${e.field}]${e.found !== undefined ? ` (found: "${e.found}")` : ''} ${e.message}`));
    const validationCommentPath = path.join(RUNNER_TEMP, `new-event-${issueNumber}-validation.md`);
    await fs.writeFile(validationCommentPath, buildValidationComment(errors));
    await setOutput('valid', 'false');
    await setOutput('validation_comment_path', validationCommentPath);
    process.exit(0);
  }

  const nodeRecord = {
    id: eventId,
    organizers,
    primary_contact: { name: primaryContactName, email: contactEmail },
    organization_name: organizationName,
    organization_url: organizationUrl,
    organization_type: organizationType,
    online_event: isOnlineEvent,
    event_url: eventUrl,
    event_name: eventName,
    event_location: {
      address,
      plus_code: plusCode,
    },
    event_date: eventDate,
    ...(eventEndDate ? { event_end_date: eventEndDate } : {}),
    event_start_time: startTime,
    event_end_time: endTime,
    event_short_description: shortDescription,
    event_activities: activities,
    event_page_url: eventWebsite,
    forum_thread_url: forumThreadUrl,
    city,
    country,
    placeholder: false,
    intake: {
      issue_number: issueNumber,
      submitted_by_github: submitterLogin,
      submitted_date: new Date().toISOString().slice(0, 10),
      maintainer_notes: maintainerNotes,
    },
  };

  const markdownLines = [
    '---',
    `id: ${eventId}`,
    '---',
    '',
    ...(fullDescription ? [fullDescription, ''] : []),
  ];

  await fs.mkdir(eventDirPath, { recursive: true });
  await fs.writeFile(markdownPath, markdownLines.join('\n'));
  await fs.writeFile(metadataPath, `${JSON.stringify(nodeRecord, null, 2)}\n`);

  const prBodyPath = path.join(RUNNER_TEMP, `new-event-${issueNumber}-pr-body.md`);
  await fs.writeFile(prBodyPath, buildPrBody(issueNumber, eventName, submitterLogin, isOnlineEvent, eventDate, startTime, address, plusCodeNote, rawPlusCode, resolvedPlusCode, shortDescription, fullDescription, primaryContactName, contactEmail));

  console.log(`[process-new-event-issue] validation passed — event id: ${eventId}`);
  await setOutput('valid', 'true');
  await setOutput('branch', `automation/new-event-${issueNumber}-${eventId}`);
  await setOutput('commit_message', `Add ${eventName} event from issue #${issueNumber}`);
  await setOutput('pr_title', `Add ${eventName} to the PCD map`);
  await setOutput('pr_body_path', prBodyPath);
  await setOutput('event_name', eventName);
}

await main().catch(async (err) => {
  console.error('[process-new-event-issue] unhandled error:', err);
  try {
    const validationCommentPath = path.join(RUNNER_TEMP, `new-event-${issueNumber}-validation.md`);
    await fs.writeFile(validationCommentPath, [
      'Thanks for submitting your event to Processing Community Day 2026! 🌍',
      '',
      'An unexpected error occurred while processing your submission. Our team has been notified.',
      '',
      `If this persists, please ask in the [PCD 2026 forum thread](${PCD_FORUM_THREAD_URL}) or write to ${PCD_CONTACT_EMAIL}.`,
    ].join('\n'));
    await setOutput('valid', 'false');
    await setOutput('validation_comment_path', validationCommentPath);
  } catch {
    // Best-effort — if we can't write the comment, at least exit non-zero
  }
  process.exit(1);
});
