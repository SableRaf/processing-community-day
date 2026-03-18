import fs from 'node:fs/promises';
import path from 'node:path';
import { resolvePlusCode } from './plus-code.mjs';
import {
  YEAR,
  PCD_FORUM_THREAD_URL,
  PCD_CONTACT_EMAIL,
  VALID_ORG_TYPES,
  VALID_EVENT_FORMATS,
  PLUS_CODE_FIELD_ALIASES,
  parseIssueSections,
  required,
  requiredAny,
  isValidDate,
  isValidTime,
  isValidEmail,
  isValidHttpUrl,
  parseActivities,
  parseOrganizers,
  buildValidationComment,
} from './event-issue-helpers.mjs';

const WORKSPACE = process.cwd();
const RUNNER_TEMP = process.env.RUNNER_TEMP ?? path.join(WORKSPACE, '.tmp');
const OUTPUT_PATH = process.env.GITHUB_OUTPUT;
const EVENT_PATH = process.env.GITHUB_EVENT_PATH;

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

function buildPrBody(number, eventName, submitterLogin, isOnlineEvent, eventDate, startTime, address, plusCodeNote, rawPlusCode, resolvedPlusCode, shortDescription, fullDescription, contactName, contactEmail) {
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
    `This PR was generated from the "Edit Event" issue form for **${eventName}**.`,
    `Submitted by ${submitterMention}.`,
    '',
    'Review checklist:',
    `- [ ] Event name "${eventName}" is correct`,
    `Public name "${contactName}" and address "${address}" are correct`,
    ...(shortDescription ? [] : ['- [ ] Short description is left blank — confirm this is intentional']),
    ...(fullDescription ? [] : ['- [ ] Long description is left blank — confirm this is intentional']),
    dateLine,
    locationLine,
    '- [ ] Check the map and event details page in the **Netlify preview** (link posted below by the Netlify bot)',
  ].join('\n');
}

console.log(`[process-edit-event-issue] issue #${issueNumber}, body length: ${issueBody.length}`);

// Skip if this is NOT an edit-event issue (must have ### Event canonical ID heading)
if (!issueBody.includes('### Event canonical ID')) {
  console.log('[process-edit-event-issue] ### Event canonical ID heading not found — skipping (not an edit event issue)');
  await setOutput('valid', 'skip');
  process.exit(0);
}

async function main() {
  const fields = parseIssueSections(issueBody);
  const errors = [];

  const canonicalId = required(fields, 'Event canonical ID', errors);
  const eventName = required(fields, 'Event name', errors);
  const rawPlusCode = requiredAny(fields, PLUS_CODE_FIELD_ALIASES, errors, {
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
  const eventPageUrl = fields.get('Event page URL')?.trim() ?? '';
  const organizers = parseOrganizers(fields.get('Organizers')?.trim() ?? '');
  const shortDescription = fields.get('Short description')?.trim() ?? '';
  const fullDescription = fields.get('Full event description')?.trim() ?? '';
  const submittedActivities = parseActivities(fields.get('Event activities')?.trim() ?? '');
  const forumThreadUrl = fields.get('Forum discussion URL')?.trim() ?? '';
  const maintainerNotes = fields.get('Additional notes')?.trim() ?? '';

  // Parse uid from canonical ID (format: <slug>-<7hexchars>)
  let submittedUid = null;
  let eventId = null;
  if (canonicalId) {
    const match = canonicalId.trim().match(/^(.+)-([0-9a-f]{7})$/);
    if (match) {
      eventId = match[1];
      submittedUid = match[2];
    } else {
      errors.push({ field: 'Event canonical ID', found: canonicalId, message: 'Not a valid canonical event ID. It should look like `pcd-mycity-2026-a1b2c3d`.' });
    }
  }

  // Find event directory by scanning metadata files for matching uid
  let eventDirPath = null;
  if (submittedUid && errors.length === 0) {
    const allEvents = await fs.readdir(path.join(WORKSPACE, 'pcd-website/src/content/events'));
    for (const dir of allEvents) {
      const metaPath = path.join(WORKSPACE, 'pcd-website/src/content/events', dir, 'metadata.json');
      try {
        const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
        if (meta.uid === submittedUid) {
          eventDirPath = path.join(WORKSPACE, 'pcd-website/src/content/events', dir);
          eventId = meta.id;
          break;
        }
      } catch { /* skip unreadable dirs */ }
    }
    if (!eventDirPath) {
      errors.push({ field: 'Event canonical ID', found: canonicalId, message: `No event with canonical ID \`${canonicalId}\` exists. Please double-check and try again.` });
    }
  }

  const markdownPath = eventDirPath ? path.join(eventDirPath, 'content.md') : null;
  const metadataPath = eventDirPath ? path.join(eventDirPath, 'metadata.json') : null;

  // Load existing metadata and content (only if event was found)
  let existingMeta = null;
  let existingContent = null;
  if (eventDirPath && errors.length === 0) {
    existingMeta = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    try {
      existingContent = await fs.readFile(markdownPath, 'utf8');
    } catch {
      existingContent = null;
    }
  }

  // Resolve plus_code with smart recovery before validation
  const { code: resolvedPlusCode, note: plusCodeNote } = await resolvePlusCode(rawPlusCode, city, country);
  const plusCode = resolvedPlusCode ?? rawPlusCode.replace(/\s+/g, '').toUpperCase();
  if (plusCodeNote) {
    console.log(`[process-edit-event-issue] plus_code auto-recovered: ${rawPlusCode} → ${plusCode}`);
  }

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
  if (eventPageUrl && !isValidHttpUrl(eventPageUrl)) errors.push({ field: 'Event page URL', found: eventPageUrl, message: 'Must be a valid URL starting with `http://` or `https://`.' });
  if (forumThreadUrl && !isValidHttpUrl(forumThreadUrl)) errors.push({ field: 'Forum discussion URL', found: forumThreadUrl, message: 'Must be a valid URL starting with `http://` or `https://`.' });
  if (contactEmail && !isValidEmail(contactEmail)) errors.push({ field: 'Primary contact email', found: contactEmail, message: 'Not a valid email address. Please provide a valid email like `you@example.com`.' });
  if (rawPlusCode && !resolvedPlusCode) errors.push({ field: 'Map placement (Plus Code)', found: rawPlusCode.replace(/\s+/g, '').toUpperCase(), message: 'Not a valid full global Plus Code. It should look like `8FW4V75V+8Q`. [Find your Plus Code →](https://plus.codes/)' });
  if (eventUrl && !isValidHttpUrl(eventUrl)) errors.push({ field: 'Event URL', found: eventUrl, message: 'Must be a valid URL starting with `http://` or `https://`.' });
  if (organizationUrl && !isValidHttpUrl(organizationUrl)) errors.push({ field: 'Organization website', found: organizationUrl, message: 'Must be a valid URL starting with `http://` or `https://`.' });
  if (eventFormat && !VALID_EVENT_FORMATS.has(eventFormat)) errors.push({ field: 'Event format', found: eventFormat, message: 'Not a recognized option. Please choose one of: `In person` or `Online`.' });
  if (organizationType && !VALID_ORG_TYPES.has(organizationType)) errors.push({ field: 'Organization type', found: organizationType, message: 'Not a recognized option. Please choose one of the valid options from the form.' });
  if (isOnlineEvent && !eventUrl) errors.push({ field: 'Event URL', message: 'An event URL is required for online events. Please provide the URL where people can join.' });

  if (errors.length > 0) {
    console.log(`[process-edit-event-issue] validation failed with ${errors.length} error(s):`);
    errors.forEach((e) => console.log(`  - [${e.field}]${e.found !== undefined ? ` (found: "${e.found}")` : ''} ${e.message}`));
    const validationCommentPath = path.join(RUNNER_TEMP, `validation-${issueNumber}.md`);
    await fs.writeFile(validationCommentPath, buildValidationComment(errors));
    await setOutput('valid', 'false');
    await setOutput('validation_comment_path', validationCommentPath);
    process.exit(0);
  }

  // Preserve uid (immutable) and intake block from existing metadata
  const uid = existingMeta.uid;
  const existingIntake = existingMeta.intake;

  // Preserve event_activities if all checkboxes came back unchecked
  const activities = submittedActivities.length > 0 ? submittedActivities : (existingMeta.event_activities ?? []);

  const nodeRecord = {
    id: eventId,
    ...(uid ? { uid } : {}),
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
    event_page_url: eventPageUrl,
    forum_thread_url: forumThreadUrl,
    city,
    country,
    placeholder: existingMeta.placeholder ?? false,
    intake: existingIntake,
  };

  await fs.writeFile(metadataPath, `${JSON.stringify(nodeRecord, null, 2)}\n`);

  // Preserve content.md if full_description is blank
  if (fullDescription) {
    const markdownLines = [
      '---',
      `id: ${eventId}`,
      ...(uid ? [`uid: ${uid}`] : []),
      '---',
      '',
      fullDescription,
      '',
    ];
    await fs.writeFile(markdownPath, markdownLines.join('\n'));
  }
  // else: leave existing content.md unchanged

  const prBodyPath = path.join(RUNNER_TEMP, `pr-body-${issueNumber}.md`);
  await fs.writeFile(prBodyPath, buildPrBody(issueNumber, eventName, submitterLogin, isOnlineEvent, eventDate, startTime, address, plusCodeNote, rawPlusCode, resolvedPlusCode, shortDescription, fullDescription, primaryContactName, contactEmail));

  console.log(`[process-edit-event-issue] validation passed — event id: ${eventId}`);
  await setOutput('valid', 'true');
  await setOutput('branch', `automation/edit-event-${issueNumber}-${eventId}`);
  await setOutput('commit_message', `Update ${eventName} event from issue #${issueNumber}`);
  await setOutput('pr_title', `Update ${eventName} on the PCD map`);
  await setOutput('pr_body_path', prBodyPath);
  await setOutput('event_name', eventName);
  await setOutput('pr_label', 'edit event');
  await setOutput('action_verb', 'updated on');
}

await main().catch(async (err) => {
  console.error('[process-edit-event-issue] unhandled error:', err);
  try {
    const validationCommentPath = path.join(RUNNER_TEMP, `validation-${issueNumber}.md`);
    await fs.writeFile(validationCommentPath, [
      'Thanks for submitting your event edit to Processing Community Day 2026! 🌍',
      '',
      'An unexpected error occurred while processing your submission. Our team has been notified.',
      '',
      `If this persists, please ask in the [PCD 2026 forum thread](${PCD_FORUM_THREAD_URL}) or write to ${PCD_CONTACT_EMAIL}.`,
    ].join('\n'));
    await setOutput('valid', 'false');
    await setOutput('validation_comment_path', validationCommentPath);
  } catch {
    // Best-effort
  }
  process.exit(1);
});
