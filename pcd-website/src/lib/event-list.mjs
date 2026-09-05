/** Calendar dates use the visitor's local day, without converting event dates to UTC. */
export function localDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function dateHeading(day, today = localDay()) {
  if (!day) return { title: 'Events without a confirmed date', weekday: '' };
  const date = new Date(`${day}T12:00:00`);
  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    title: day === today ? 'Today' : day === localDay(tomorrow) ? 'Tomorrow' : date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', ...(day.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}),
    }),
    weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
  };
}

export function confirmationFields(node) {
  return {
    date: Boolean(node.event_date?.trim()),
    time: Boolean(node.event_start_time?.trim()),
    location: Boolean(node.online_event ? node.event_url?.trim() : node.address?.trim()),
    description: Boolean(node.event_short_description?.trim() || node.details_text?.trim()),
  };
}

export function normalizeSearch(text) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Ongoing events appear under Today; undated events belong to the Other events tab. */
export function eventGroupDay(event, today) {
  if (event.date && event.date < today && (event.end || event.date) >= today) return today;
  return event.date;
}

export function matchesEvent(event, { today, tab = 'upcoming', query = '', required = [] }) {
  const isPast = Boolean(event.date && (event.end || event.date) < today);
  const eventTab = !event.date ? 'other' : isPast ? 'past' : 'upcoming';
  if (eventTab !== tab) return false;
  if (required.length > 0 && (event.placeholder || !required.every((field) => event.fields[field]))) return false;
  const text = normalizeSearch(event.search);
  return normalizeSearch(query).trim().split(/\s+/).every((term) => text.includes(term));
}
