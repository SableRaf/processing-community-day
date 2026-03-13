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
  const matches = [...normalized.matchAll(/^### (.+)\n([\s\S]*?)(?=^### |\s*$)/gm)];
  return new Map(matches.map(([, label, value]) => {
    const cleaned = value.trim().replace(/^_No response_\s*$/m, '').trim();
    return [label.trim(), cleaned];
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

function isValidGitHubProfileUrl(value) {
  return /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/?$/.test(value.trim());
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

function parseOrganizers(raw, errors) {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    errors.push('Organizers must include at least one person.');
    return [];
  }

  return lines.map((line) => {
    // Strip optional "<email>" suffix if someone provides it, but don't require it
    const match = line.match(/^(.*?)\s*<[^>]+>$/);
    const name = (match ? match[1] : line).trim();
    return { name };
  }).filter((organizer) => organizer.name);
}

function toYamlScalar(value) {
  return JSON.stringify(value ?? '');
}

function toYamlList(values, indent = 0) {
  const prefix = ' '.repeat(indent);
  return values.map((value) => `${prefix}- ${toYamlScalar(value)}`).join('\n');
}

function toYamlOrganizerList(values, indent = 0) {
  const prefix = ' '.repeat(indent);
  return values.map((value) => `${prefix}- name: ${toYamlScalar(value.name)}`).join('\n');
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
    '- [ ] Dates and times are correct',
    '- [ ] Address, plus code, or online URL are correct',
    '- [ ] Public contact info is correct',
    '- [ ] Short description and full event description are ready to publish',
  ].join('\n');
}

if (!issueBody.includes('<!-- new-event-template -->')) {
  await setOutput('valid', 'false');
  const noopCommentPath = path.join(RUNNER_TEMP, `new-event-${issueNumber}-noop.md`);
  await fs.writeFile(noopCommentPath, 'Issue does not use the New Event template.');
  await setOutput('validation_comment_path', noopCommentPath);
  process.exit(0);
}

const fields = parseIssueSections(issueBody);
const errors = [];

const eventName = required(fields, 'Event name', errors);
const city = fields.get('City')?.trim() ?? '';
const country = fields.get('Country')?.trim() ?? '';
const organizationName = fields.get('Organization name')?.trim() ?? '';
const organizationUrl = fields.get('Organization website')?.trim() ?? '';
const organizationType = required(fields, 'Organization type', errors);
const address = fields.get('Street address')?.trim() ?? '';
const plusCode = required(fields, 'Full global plus code in the format XXXXXXXX+XX', errors).replace(/\s+/g, '').toUpperCase();
const eventDate = required(fields, 'Event date', errors);
const eventEndDate = fields.get('End date')?.trim() ?? '';
const startTime = fields.get('Start time')?.trim() ?? '';
const endTime = fields.get('End time')?.trim() ?? '';
const eventWebsite = fields.get('Event website')?.trim() ?? '';
const primaryContactName = required(fields, 'Primary contact name', errors);
const contactEmail = required(fields, 'Primary contact email', errors);
const organizers = parseOrganizers(required(fields, 'Organizers', errors), errors);
const shortDescription = required(fields, 'Short description', errors);
const fullDescription = required(fields, 'Full event description', errors);
const activities = parseActivities(fields.get('Event activities')?.trim() ?? '');
const eventUrl = fields.get('Online event URL')?.trim() ?? '';
const forumThreadUrl = fields.get('Forum discussion URL')?.trim() ?? '';
const submittedBy = fields.get('Your GitHub profile URL')?.trim() ?? '';
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

if (eventDate && !isValidDate(eventDate)) errors.push(`Event date must use YYYY-MM-DD and be a real date. Received "${eventDate}".`);
if (eventEndDate && !isValidDate(eventEndDate)) errors.push(`End date must use YYYY-MM-DD and be a real date. Received "${eventEndDate}".`);
if (isValidDate(eventDate) && eventEndDate && isValidDate(eventEndDate) && eventEndDate < eventDate) errors.push('End date cannot be earlier than event date.');
if (startTime && !isValidTime(startTime)) errors.push(`Start time must use 24-hour HH:MM. Received "${startTime}".`);
if (endTime && !isValidTime(endTime)) errors.push(`End time must use 24-hour HH:MM. Received "${endTime}".`);
if (startTime && endTime && isValidTime(startTime) && isValidTime(endTime) && endTime <= startTime) errors.push('End time must be later than start time.');
if (eventWebsite && !isValidHttpUrl(eventWebsite)) errors.push(`Event website must be a valid http or https URL. Received "${eventWebsite}".`);
if (forumThreadUrl && !isValidHttpUrl(forumThreadUrl)) errors.push(`Forum discussion URL must be a valid http or https URL. Received "${forumThreadUrl}".`);
if (contactEmail && !isValidEmail(contactEmail)) errors.push(`Primary contact email is not valid. Received "${contactEmail}".`);
if (plusCode && !isValidPlusCode(plusCode)) errors.push(`Full global plus code is not valid. Received "${plusCode}".`);
if (eventUrl && !isValidHttpUrl(eventUrl)) errors.push(`Online event URL must be a valid http or https URL. Received "${eventUrl}".`);
if (organizationType && !VALID_ORG_TYPES.has(organizationType)) errors.push(`Organization type "${organizationType}" is not one of the valid options.`);
if (submittedBy && !isValidGitHubProfileUrl(submittedBy)) errors.push(`Your GitHub profile URL must start with https://github.com/. Received "${submittedBy}".`);

const idSource = `${eventName}-${YEAR}`;
const eventId = slugify(idSource.startsWith('pcd-') ? idSource : `pcd-${idSource}`);

const nodesJsonPath = path.join(WORKSPACE, 'pcd-website/src/data/nodes.json');
const markdownPath = path.join(WORKSPACE, 'pcd-website/src/content/events', `${eventId}.md`);
const nodesData = JSON.parse(await fs.readFile(nodesJsonPath, 'utf8'));

if (nodesData.nodes.some((node) => node.id === eventId)) {
  errors.push(`An event with the generated id "${eventId}" already exists. Update the existing event instead of creating a duplicate.`);
}

if (errors.length > 0) {
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
  online_event: !!eventUrl,
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
  event_long_description: fullDescription,
  event_activities: activities,
  event_website: eventWebsite,
  forum_thread_url: forumThreadUrl,
  city,
  country,
  placeholder: false,
};

nodesData.nodes.push(nodeRecord);
nodesData.nodes.sort((a, b) => {
  const byDate = (a.event_date ?? '').localeCompare(b.event_date ?? '');
  if (byDate !== 0) return byDate;
  return a.event_name.localeCompare(b.event_name);
});

const markdownLines = [
  '---',
  `id: ${eventId}`,
  `title: ${toYamlScalar(eventName)}`,
  `organization_name: ${toYamlScalar(organizationName)}`,
  `organization_url: ${toYamlScalar(organizationUrl)}`,
  `organization_type: ${toYamlScalar(organizationType)}`,
  `online_event: ${!!eventUrl}`,
  `event_url: ${toYamlScalar(eventUrl)}`,
  `event_date: ${toYamlScalar(eventDate)}`,
  ...(eventEndDate ? [`event_end_date: ${toYamlScalar(eventEndDate)}`] : []),
  `event_start_time: ${toYamlScalar(startTime)}`,
  `event_end_time: ${toYamlScalar(endTime)}`,
  'event_location:',
  `  address: ${toYamlScalar(address)}`,
  `  plus_code: ${toYamlScalar(plusCode)}`,
  `event_website: ${toYamlScalar(eventWebsite)}`,
  `event_short_description: ${toYamlScalar(shortDescription)}`,
  ...(activities.length ? ['event_activities:', toYamlList(activities, 2)] : ['event_activities: []']),
  `forum_thread_url: ${toYamlScalar(forumThreadUrl)}`,
  `city: ${toYamlScalar(city)}`,
  `country: ${toYamlScalar(country)}`,
  'primary_contact:',
  `  name: ${toYamlScalar(primaryContactName)}`,
  `  email: ${toYamlScalar(contactEmail)}`,
  'organizers:',
  toYamlOrganizerList(organizers, 2),
  `submitted_by: ${toYamlScalar(submittedBy)}`,
  `issue_number: ${issueNumber}`,
  `maintainer_notes: ${toYamlScalar(maintainerNotes)}`,
  '---',
  '',
  fullDescription.trim(),
  '',
];

await fs.writeFile(nodesJsonPath, `${JSON.stringify(nodesData, null, 2)}\n`);
await fs.writeFile(markdownPath, markdownLines.join('\n'));

const prBodyPath = path.join(RUNNER_TEMP, `new-event-${issueNumber}-pr-body.md`);
await fs.writeFile(prBodyPath, buildPrBody(issueNumber, eventName));

await setOutput('valid', 'true');
await setOutput('branch', `automation/new-event-${issueNumber}-${eventId}`);
await setOutput('commit_message', `Add ${eventName} event from issue #${issueNumber}`);
await setOutput('pr_title', `Add ${eventName} to the PCD map`);
await setOutput('pr_body_path', prBodyPath);
