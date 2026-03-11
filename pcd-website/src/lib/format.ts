import type { Node } from './nodes';

export function formatDate(dateString: string): string {
  try {
    // Parse as UTC to avoid timezone issues with date-only strings
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateString;
  }
}

export function formatDateRange(startDate: string, endDate?: string): string {
  if (!endDate || endDate === startDate) return formatDate(startDate);
  try {
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [ey, em, ed] = endDate.split('-').map(Number);
    const start = new Date(Date.UTC(sy, sm - 1, sd));
    const end = new Date(Date.UTC(ey, em - 1, ed));
    const sameYear = sy === ey;
    const sameMonth = sameYear && sm === em;
    if (sameMonth) {
      // e.g. "October 17–18, 2026"
      const month = start.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
      return `${month} ${sd}–${ed}, ${sy}`;
    } else if (sameYear) {
      // e.g. "October 30 – November 1, 2026"
      const s = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
      const e = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
      return `${s} – ${e}, ${sy}`;
    } else {
      // e.g. "December 31, 2026 – January 1, 2027"
      return `${formatDate(startDate)} – ${formatDate(endDate)}`;
    }
  } catch {
    return formatDate(startDate);
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
    details: node.long_description ?? node.description,
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
    `DESCRIPTION:${escapeIcs(node.long_description ?? node.description)}`,
    `URL:${node.website}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return { googleCalUrl, icsContent };
}
