import fs from 'node:fs/promises';
import path from 'node:path';

const WORKSPACE = process.cwd();
const RUNNER_TEMP = process.env.RUNNER_TEMP ?? path.join(WORKSPACE, '.tmp');
const OUTPUT_PATH = process.env.GITHUB_OUTPUT;
const EVENT_PATH = process.env.GITHUB_EVENT_PATH;
const YEAR = '2026';

await fs.mkdir(RUNNER_TEMP, { recursive: true });

const eventPayload = JSON.parse(await fs.readFile(EVENT_PATH, 'utf8'));
const issue = eventPayload.issue;
const issueNumber = issue.number;
const issueBody = issue.body ?? '';

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

function required(fields, label, errors) {
  const value = fields.get(label)?.trim() ?? '';
  if (!value) errors.push(`${label} is required.`);
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

function isValidPlusCode(value) {
  const normalized = value.replace(/\s+/g, '').toUpperCase();
  return /^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2,3}$/.test(normalized);
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

function buildValidationComment(errors) {
  return [
    'Thanks for submitting a new event. I could not generate the branch and pull request yet because a few fields need attention:',
    '',
    ...errors.map((error) => `- ${error}`),
    '',
    'Please edit the issue with the missing or corrected information. Opening a fresh submission is also fine if that is easier.',
  ].join('\n');
}

function buildPrBody(number, name) {
  return [
    `Closes #${number}`,
    '',
    `This PR was generated from the "New Event" issue form for **${name}**.`,
    '',
    'Review checklist:',
    '- [ ] Event format and venue/link details are correct',
    '- [ ] Dates and times are correct',
    '- [ ] Public contact info is correct',
    '- [ ] Short description and full event description are ready to publish',
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

const fields = parseIssueSections(issueBody);
const errors = [];

const eventName = required(fields, 'Event name', errors);
const plusCode = required(fields, 'Map placement', errors).replace(/\s+/g, '').toUpperCase();
const eventFormat = required(fields, 'Event format', errors);
const isOnlineEvent = eventFormat === 'Online';
const eventUrl = fields.get('Event URL (only for online events)')?.trim() ?? '';
const primaryContactName = required(fields, 'Primary contact name', errors);
const contactEmail = required(fields, 'Primary contact email', errors);
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

if (eventDate && !isValidDate(eventDate)) errors.push(`Event date must use YYYY-MM-DD and be a real date. Received "${eventDate}".`);
if (eventEndDate && !isValidDate(eventEndDate)) errors.push(`End date must use YYYY-MM-DD and be a real date. Received "${eventEndDate}".`);
if (isValidDate(eventDate) && eventEndDate && isValidDate(eventEndDate) && eventEndDate < eventDate) errors.push('End date cannot be earlier than event date.');
if (startTime && !isValidTime(startTime)) errors.push(`Start time must use 24-hour HH:MM. Received "${startTime}".`);
if (endTime && !isValidTime(endTime)) errors.push(`End time must use 24-hour HH:MM. Received "${endTime}".`);
if (
  startTime &&
  endTime &&
  isValidTime(startTime) &&
  isValidTime(endTime) &&
  (!eventEndDate || eventEndDate === eventDate) &&
  endTime <= startTime
) {
  errors.push('End time must be later than start time for single-day events.');
}
if (eventWebsite && !isValidHttpUrl(eventWebsite)) errors.push(`Event website must be a valid http or https URL. Received "${eventWebsite}".`);
if (forumThreadUrl && !isValidHttpUrl(forumThreadUrl)) errors.push(`Forum discussion URL must be a valid http or https URL. Received "${forumThreadUrl}".`);
if (contactEmail && !isValidEmail(contactEmail)) errors.push(`Primary contact email is not valid. Received "${contactEmail}".`);
if (plusCode && !isValidPlusCode(plusCode)) errors.push(`Full global plus code is not valid. Received "${plusCode}".`);
if (eventUrl && !isValidHttpUrl(eventUrl)) errors.push(`Online event URL must be a valid http or https URL. Received "${eventUrl}".`);
if (organizationUrl && !isValidHttpUrl(organizationUrl)) errors.push(`Organization website must be a valid http or https URL. Received "${organizationUrl}".`);
if (eventFormat && !VALID_EVENT_FORMATS.has(eventFormat)) errors.push(`Event format "${eventFormat}" is not one of the valid options.`);
if (organizationType && !VALID_ORG_TYPES.has(organizationType)) errors.push(`Organization type "${organizationType}" is not one of the valid options.`);
if (isOnlineEvent && !eventUrl) errors.push('Event URL is required for online events.');

const normalizedEventName = slugify(eventName);
const eventId = normalizedEventName.startsWith('pcd-')
  ? `${normalizedEventName}-${YEAR}`
  : `pcd-${normalizedEventName}-${YEAR}`;

const eventDirPath = path.join(WORKSPACE, 'pcd-website/src/content/events', eventId);
const markdownPath = path.join(eventDirPath, 'content.md');
const metadataPath = path.join(eventDirPath, 'metadata.json');

try {
  await fs.access(eventDirPath);
  errors.push(`An event with the generated id "${eventId}" already exists. Update the existing event instead of creating a duplicate.`);
} catch {
  // Directory does not exist yet.
}

if (errors.length > 0) {
  console.log(`[process-new-event-issue] validation failed with ${errors.length} error(s):`);
  errors.forEach((e) => console.log(`  - ${e}`));
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
await fs.writeFile(prBodyPath, buildPrBody(issueNumber, eventName));

console.log(`[process-new-event-issue] validation passed — event id: ${eventId}`);
await setOutput('valid', 'true');
await setOutput('branch', `automation/new-event-${issueNumber}-${eventId}`);
await setOutput('commit_message', `Add ${eventName} event from issue #${issueNumber}`);
await setOutput('pr_title', `Add ${eventName} to the PCD map`);
await setOutput('pr_body_path', prBodyPath);
