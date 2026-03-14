import type { Node } from './nodes';

export function formatDate(dateString: string, abbrev = false): string {
  try {
    // Parse as UTC to avoid timezone issues with date-only strings
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString('en-US', {
      weekday: abbrev ? 'short' : undefined,
      year: 'numeric',
      month: abbrev ? 'short' : 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateString;
  }
}

export function formatDateRange(startDate: string, endDate?: string, abbrev = false): string {
  if (!endDate || endDate === startDate) return formatDate(startDate, abbrev);
  try {
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [ey, em, ed] = endDate.split('-').map(Number);
    const start = new Date(Date.UTC(sy, sm - 1, sd));
    const end = new Date(Date.UTC(ey, em - 1, ed));
    const monthStyle = abbrev ? 'short' : 'long';
    const sameYear = sy === ey;
    const sameMonth = sameYear && sm === em;
    if (sameMonth) {
      // e.g. "October 17–18, 2026" / "Oct 17–18, 2026"
      const month = start.toLocaleDateString('en-US', { month: monthStyle, timeZone: 'UTC' });
      return `${month} ${sd}–${ed}, ${sy}`;
    } else if (sameYear) {
      // e.g. "October 30 – November 1, 2026" / "Oct 30 – Nov 1, 2026"
      const s = start.toLocaleDateString('en-US', { month: monthStyle, day: 'numeric', timeZone: 'UTC' });
      const e = end.toLocaleDateString('en-US', { month: monthStyle, day: 'numeric', timeZone: 'UTC' });
      return `${s} – ${e}, ${sy}`;
    } else {
      // e.g. "December 31, 2026 – January 1, 2027"
      return `${formatDate(startDate, abbrev)} – ${formatDate(endDate, abbrev)}`;
    }
  } catch {
    return formatDate(startDate, abbrev);
  }
}

function toICalDate(dateString: string): string {
  return dateString.replace(/-/g, '');
}

function nextDay(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('');
}

function escapeIcs(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function calendarLinks(node: Node): { googleCalUrl: string; outlookCalUrl: string; icsContent: string } {
  const startDate = toICalDate(node.event_date ?? '');
  const endDate = node.event_end_date ? toICalDate(node.event_end_date) : nextDay(node.event_date ?? '');
  const location = node.location_tbd
    ? 'Location TBD'
    : node.address ?? 'Location TBD';

  // Google Calendar URL
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: node.event_name,
    dates: `${startDate}/${endDate}`,
    location,
    details: node.details_text || node.event_short_description,
  });
  const googleCalUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;

  // Outlook Web Calendar URL
  const outlookParams = new URLSearchParams({
    subject: node.event_name,
    startdt: node.event_date ?? '',
    enddt: node.event_end_date ?? node.event_date ?? '',
    body: node.details_text || node.event_short_description,
    location,
  });
  const outlookCalUrl = `https://outlook.live.com/calendar/0/action/compose?${outlookParams.toString()}`;

  // ICS content
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const icsLocation = node.location_tbd
    ? 'Location TBD'
    : node.address
      ? node.address.replace(/,/g, '\\,')
      : 'Location TBD';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PCD2026//EN',
    'BEGIN:VEVENT',
    `UID:${node.id}-${node.event_date}@pcd2026`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${startDate}`,
    `DTEND;VALUE=DATE:${endDate}`,
    `SUMMARY:${escapeIcs(node.event_name)}`,
    `LOCATION:${icsLocation}`,
    `DESCRIPTION:${escapeIcs(node.details_text || node.event_short_description)}`,
    `URL:${node.event_page_url ?? ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return { googleCalUrl, outlookCalUrl, icsContent };
}

export function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

export function formatPopupDate(startDate: string, endDate?: string): string {
  return formatDateRange(startDate, endDate, true);
}

const PLATFORM_PATTERNS: [RegExp, string][] = [
  [/zoom\.us/i, 'Zoom'],
  [/meet\.google\.com/i, 'Google Meet'],
  [/teams\.microsoft\.com|teams\.live\.com/i, 'Microsoft Teams'],
  [/webex\.com/i, 'Webex'],
  [/whereby\.com/i, 'Whereby'],
  [/jitsi\.(org|meet)/i, 'Jitsi'],
  [/discord\.(gg|com)/i, 'Discord'],
  [/twitch\.tv/i, 'Twitch'],
  [/youtube\.com|youtu\.be/i, 'YouTube'],
  [/streamyard\.com/i, 'StreamYard'],
  [/hopin\.com/i, 'Hopin'],
  [/airmeet\.com/i, 'Airmeet'],
  [/gather\.town/i, 'Gather'],
  [/spatial\.chat/i, 'Spatial Chat'],
  [/crowdcast\.io/i, 'Crowdcast'],
  [/eventbrite\.com/i, 'Eventbrite'],
  [/lu\.ma/i, 'Luma'],
];

export function onlinePlatformName(url?: string): string {
  if (!url) return 'Online';
  for (const [pattern, name] of PLATFORM_PATTERNS) {
    if (pattern.test(url)) return name;
  }
  return 'Online';
}

type FormattedTime = {
  display: string;
  base: string;
  period?: 'AM' | 'PM';
};

export function formatTime(timeString: string): FormattedTime {
  if (!timeString) return { display: '', base: '' };
  const [hourSegment, minuteSegment = '00'] = timeString.split(':');
  const hour = Number(hourSegment);
  const minute = Number(minuteSegment);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return { display: timeString, base: timeString };
  }
  const normalizedHour = ((hour % 24) + 24) % 24;
  const normalizedMinute = Math.min(59, Math.max(0, minute));
  const hour12 = normalizedHour % 12 || 12;
  const base = `${hour12}:${String(normalizedMinute).padStart(2, '0')}`;
  const period = normalizedHour < 12 ? 'AM' : 'PM';
  return { display: `${base} ${period}`, base, period };
}

export function formatTimeRange(startTime?: string, endTime?: string): string {
  if (!startTime) return '';
  const start = formatTime(startTime);
  if (endTime) {
    const end = formatTime(endTime);
    if (start.period && end.period && start.period === end.period) {
      return `${start.base}-${end.base} ${start.period}`;
    }
    return `${start.display} to ${end.display}`;
  }
  return `${start.display}`;
}
