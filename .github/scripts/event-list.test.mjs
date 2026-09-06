import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmationFields, dateHeading, eventCategory, eventGroupDay, localDay, matchesEvent } from '../../pcd-website/src/lib/event-list.mjs';
const today = '2026-09-05';
const event = { date: today, end: '', placeholder: false, fields: { date: true, time: true, location: true, description: true }, search: 'Creative coding São Paulo' };

test('headings show Today and Tomorrow with actual weekdays across year boundaries', () => {
  assert.deepEqual(dateHeading(today, today), { title: 'Today', weekday: 'Saturday' });
  assert.deepEqual(dateHeading('2026-09-06', today), { title: 'Tomorrow', weekday: 'Sunday' });
  assert.deepEqual(dateHeading('2026-09-09', today), { title: 'Sep 9', weekday: 'Wednesday' });
  assert.equal(dateHeading('2027-01-01', '2026-12-31').title, 'Tomorrow');
  assert.equal(dateHeading('2025-09-09', today).title, 'Sep 9, 2025');
  assert.equal(dateHeading('', today).title, 'Events without a confirmed date');
  assert.equal(localDay(new Date(2026, 8, 5, 23, 59)), today);
});
test('past boundary includes today and ongoing events in Upcoming, undated events only in Other events', () => {
  assert.equal(matchesEvent(event, { today }), true);
  const ongoing = { ...event, date: '2026-09-01', end: today };
  assert.equal(matchesEvent(ongoing, { today }), true);
  assert.equal(eventGroupDay(ongoing, today), today);
  assert.equal(matchesEvent(ongoing, { today: '2026-09-06', tab: 'past' }), true);
  assert.equal(matchesEvent({ ...event, date: '', end: '' }, { today }), false);
  assert.equal(matchesEvent({ ...event, date: '', end: '' }, { today, tab: 'past' }), false);
  assert.equal(matchesEvent(event, { today, tab: 'past' }), false);
  assert.equal(matchesEvent({ ...event, date: '', end: '' }, { today, tab: 'other' }), true);
  assert.equal(matchesEvent(event, { today, tab: 'other' }), false);
});
test('filters apply selected fields directly and clear to show all events', () => {
  const incomplete = { ...event, fields: { ...event.fields, time: false } };
  assert.equal(matchesEvent(incomplete, { today, required: [] }), true);
  assert.equal(matchesEvent(incomplete, { today, required: ['date', 'time'] }), false);
  assert.equal(matchesEvent(incomplete, { today, required: ['date'] }), true);
  assert.equal(matchesEvent({ ...event, placeholder: true }, { today, required: ['date'] }), false);
  assert.equal(matchesEvent(incomplete, { today, required: [] }), true);
  assert.equal(matchesEvent({ ...event, placeholder: true }, { today, required: [] }), true);
});
test('confirmation distinguishes map coordinates from a venue and accepts description bodies and online links', () => {
  assert.deepEqual(confirmationFields({ plus_code: '123', event_short_description: ' ' }), { date: false, time: false, location: false, description: false });
  assert.equal(confirmationFields({ address: '12 Main Street' }).location, true);
  assert.equal(confirmationFields({ online_event: true }).location, false);
  assert.equal(confirmationFields({ online_event: true, event_url: 'https://example.com' }).location, true);
  assert.equal(confirmationFields({ details_text: 'Join us!' }).description, true);
});
test('search handles case, accents, whitespace and multiple terms alongside filters', () => {
  assert.equal(matchesEvent(event, { today, query: ' SAO  coding ' }), true);
  assert.equal(matchesEvent(event, { today, query: 'Tokyo' }), false);
  assert.equal(matchesEvent(event, { today, query: 'coding', tab: 'past' }), false);
  assert.equal(matchesEvent(event, { today, query: 'coding', tab: 'all' }), true);
  assert.equal(matchesEvent({ ...event, date: '', search: 'Bengaluru India' }, { today, query: 'india', tab: 'all' }), true);
  assert.equal(eventCategory({ ...event, date: '' }, today), 'other');
});
