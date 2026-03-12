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

export function calendarLinks(node: Node): { googleCalUrl: string; icsContent: string } {
  const startDate = toICalDate(node.start_date);
  const endDate = node.end_date ? toICalDate(node.end_date) : nextDay(node.start_date);
  const location = node.address ? `${node.venue}, ${node.address}` : `${node.venue}, ${node.city}, ${node.country}`;

  // Google Calendar URL
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: node.name,
    dates: `${startDate}/${endDate}`,
    location,
    details: node.long_description ?? node.short_description,
  });
  const googleCalUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;

  // ICS content
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const icsLocation = node.address
    ? `${node.venue}\\, ${node.address}`
    : `${node.venue}\\, ${node.city}\\, ${node.country}`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PCD2026//EN',
    'BEGIN:VEVENT',
    `UID:${node.id}-${node.start_date}@pcd2026`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${startDate}`,
    `DTEND;VALUE=DATE:${endDate}`,
    `SUMMARY:${escapeIcs(node.name)}`,
    `LOCATION:${icsLocation}`,
    `DESCRIPTION:${escapeIcs(node.long_description ?? node.short_description)}`,
    `URL:${node.website}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return { googleCalUrl, icsContent };
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

export function formatTimeRange(startTime?: string, endTime?: string, tz?: string): string {
  if (!startTime) return '';
  const fmt = (t: string) => {
    const [h, min] = t.split(':').map(Number);
    const period = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 || 12;
    return min === 0 ? `${h12}:00 ${period}` : `${h12}:${String(min).padStart(2, '0')} ${period}`;
  };
  const start = fmt(startTime);
  const tzSuffix = tz ? ` ${tz}` : '';
  if (endTime) return `${start} to ${fmt(endTime)}${tzSuffix}`;
  return `${start}${tzSuffix}`;
}
