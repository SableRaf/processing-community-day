import { randomBytes } from 'node:crypto';

export const YEAR = '2026';
export const PCD_FORUM_THREAD_URL = 'https://discourse.processing.org/t/pcd-worldwide-2026-call-for-organizers/48081';
export const PCD_CONTACT_EMAIL = 'day@processing.org';

export const VALID_ORG_TYPES = new Set([
  'School, university, library',
  'Fablab, makerspace, hackerspace',
  'Museum, gallery, media arts center',
  'Meetup, code club, community group',
  'Nonprofit, foundation, association',
  'Studio, tech company, startup',
  'Other',
]);

export const VALID_EVENT_FORMATS = new Set(['In person', 'Online']);

// Historical aliases in newest-first order (covers retried or edited older issues)
export const PLUS_CODE_FIELD_ALIASES = [
  'Plus Code (for map placement)',   // current
  'Plus Code for map placement',     // transitional (commit 24064d2)
  'Map placement',                   // original
];

export const PLUS_CODE_FIELD_LABEL = PLUS_CODE_FIELD_ALIASES[0];

// Like required(), but tries each label in order and returns the first non-empty value.
export function requiredAny(fields, labels, errors, errorOverride) {
  for (const label of labels) {
    const v = fields.get(label)?.trim();
    if (v) return v;
  }
  errors.push(errorOverride ?? { field: labels[0], message: 'This field is required.' });
  return '';
}

export function parseIssueSections(body) {
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

export function required(fields, label, errors, errorOverride) {
  const value = fields.get(label)?.trim() ?? '';
  if (!value) errors.push(errorOverride ?? { field: label, message: 'This field is required.' });
  return value;
}

export function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function isValidTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const HTTP_PROTOCOL_RE = /^https?:\/\//i;

export function normalizeUrl(value) {
  if (!value) return value;
  if (HTTP_PROTOCOL_RE.test(value)) return value;
  return `http://${value}`;
}

export function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function parseActivities(raw) {
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

export function parseOrganizers(raw) {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  return lines.map((line) => {
    const match = line.match(/^(.*?)\s*<[^>]+>$/);
    const name = (match ? match[1] : line).trim();
    return { name };
  }).filter((organizer) => organizer.name);
}

export function formatError({ field, found, message }) {
  const foundPart = found !== undefined ? ` (found: \`${found}\`)` : '';
  return `- **${field}**${foundPart} — ${message}`;
}

export function buildValidationComment(errors) {
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

export function generateUniqueUid(existingUids) {
  let uid;
  let attempts = 0;
  do {
    uid = randomBytes(4).toString('hex').slice(0, 7);
    attempts++;
    if (attempts > 1000) throw new Error('Could not generate a unique uid after 1000 attempts');
  } while (existingUids.has(uid));
  existingUids.add(uid);
  return uid;
}

// ── PR body helpers ────────────────────────────────────────────────────────────

export const PR_FIELDS = [
  { label: 'Event name',        accessor: (d) => d.event_name },
  { label: 'Contact',           accessor: (d) => {
    const name = d.primary_contact?.name?.trim();
    const email = d.primary_contact?.email?.trim();
    if (name && email) return `${name} (${email})`;
    if (name) return name;
    if (email) return email;
    return '';
  }},
  { label: 'Format',            accessor: (d) => d.online_event ? 'Online' : 'In person' },
  { label: 'Date',              accessor: (d) => d.event_date },
  { label: 'End date',          accessor: (d) => d.event_end_date },
  { label: 'Start time',        accessor: (d) => d.event_start_time },
  { label: 'End time',          accessor: (d) => d.event_end_time },
  { label: 'Address',           accessor: (d) => d.event_location?.address },
  { label: 'Plus Code',         accessor: (d) => d.event_location?.plus_code ? `\`${d.event_location.plus_code}\`` : '' },
  { label: 'City',              accessor: (d) => d.city },
  { label: 'Country',           accessor: (d) => d.country },
  { label: 'Organization',      accessor: (d) => d.organization_name },
  { label: 'Organization URL',  accessor: (d) => d.organization_url },
  { label: 'Organization type', accessor: (d) => d.organization_type },
  { label: 'Event URL',         accessor: (d) => d.event_url },
  { label: 'Event page',        accessor: (d) => d.event_page_url },
  { label: 'Forum thread',      accessor: (d) => d.forum_thread_url },
  { label: 'Short description', accessor: (d) => d.event_short_description },
  { label: 'Activities',        accessor: (d) => [...(d.event_activities ?? [])].sort().join(', ') },
  { label: 'Organizers',        accessor: (d) => (d.organizers ?? []).map(o => o.name).join(', ') },
];

export function escapeTableCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function eventDataToDisplayMap(record) {
  const map = new Map();
  for (const { label, accessor } of PR_FIELDS) {
    const raw = accessor(record);
    const isEmpty = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
    map.set(label, isEmpty ? '_No response_' : escapeTableCell(raw));
  }
  return map;
}

export function buildNewEventTable(displayMap) {
  const rows = ['| Field | Value |', '|---|---|'];
  for (const { label } of PR_FIELDS) {
    rows.push(`| ${label} | ${displayMap.get(label)} |`);
  }
  return rows.join('\n');
}

export function buildEditEventTable(previousMap, newMap) {
  const rows = [];
  for (const { label } of PR_FIELDS) {
    const prev = previousMap.get(label);
    const next = newMap.get(label);
    if (prev !== next) {
      rows.push(`| ${label} | ${prev} | ${next} |`);
    }
  }
  if (rows.length === 0) return '_No metadata changes._';
  return ['| Field | Previous | New |', '|---|---|---|', ...rows].join('\n');
}

export function formatLongDescription(text) {
  if (!text || !text.trim()) return '_No response_';
  return text.replace(/\r\n/g, '\n').split('\n').map(line => `> ${line}`).join('\n');
}

export function buildPlusCodeNoteBlocks(plusCodeNote, rawPlusCode, resolvedPlusCode) {
  if (!plusCodeNote) return [];
  return [`> [!NOTE]\n> The Plus Code was auto-recovered from the user's input (\`${rawPlusCode}\`) using the city as a reference. Please verify the map pin placement is correct (https://plus.codes/${resolvedPlusCode}).`];
}

export function buildPrBody({ mode, number, eventName, submitterLogin, plusCodeForLink, dataTable, longDescriptionSection, noteBlocks = [] }) {
  const submitterMention = submitterLogin ? `@${submitterLogin}` : 'the submitter';
  const isNew = mode === 'new';
  const formType = isNew ? 'New Event' : 'Edit Event';
  const checklistItem = isNew ? 'The event data below is accurate' : 'The changes below are correct';
  const tableSection = isNew ? '### Event data' : '### Changes';

  const lines = [
    ...noteBlocks.flatMap(b => [b, '']),
    `Closes #${number}`,
    '',
    `This PR was generated from the "${formType}" issue form for **${eventName}**.`,
    `Submitted by ${submitterMention}.`,
    '',
    '### Review checklist',
    '',
    `- [ ] ${checklistItem}`,
    ...(plusCodeForLink ? [`- [ ] The map pin is placed correctly ([check Plus Code](https://plus.codes/${plusCodeForLink}))`] : []),
    '- [ ] The event displays correctly in the **Netlify preview** (link posted by the Netlify bot)',
    '',
    tableSection,
    '',
    dataTable,
  ];

  if (longDescriptionSection) {
    lines.push('', '### Long description', '', longDescriptionSection);
  }

  return lines.join('\n');
}
