import { getIcon, addCollection } from '@iconify/vue';
import biIcons from '@iconify-json/bi/icons.json' assert { type: 'json' };
import type { Node } from './nodes';
import { formatDateRange, calendarLinks } from './format';

addCollection(biIcons as Parameters<typeof addCollection>[0]);

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function iconSvg(name: string, cssClass: string): string {
  const data = getIcon(name);
  if (!data) return '';
  const { body, width = 16, height = 16 } = data;
  return `<svg class="${cssClass}" width="13" height="13" viewBox="0 0 ${width} ${height}" fill="currentColor" aria-hidden="true">${body}</svg>`;
}

const ICON_PIN = iconSvg('bi:geo-alt-fill', 'popup-icon');
const ICON_GLOBE = iconSvg('bi:globe', 'popup-icon');
const ICON_CALENDAR = iconSvg('bi:calendar', 'popup-icon');
const ICON_EMAIL = iconSvg('bi:envelope-fill', 'popup-icon');

export function makePopupContent(node: Node): string {
  const { googleCalUrl, icsContent } = calendarLinks(node);
  const osmQuery = node.address
    ? `${node.venue}, ${node.address}`
    : `${node.venue}, ${node.city}, ${node.country}`;
  const osmUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(osmQuery)}`;
  const venueText = node.address
    ? `${node.venue}, ${node.address}`
    : `${node.venue}, ${node.city}, ${node.country}`;
  const icsDataUri = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
  const date = escapeHtml(formatDateRange(node.start_date, node.end_date));
  const location = escapeHtml(`${node.city}, ${node.country}`);
  const descriptionParagraphs = node.description
    .split(/\n\n+/)
    .filter(Boolean)
    .map(p => `<p class="popup-description">${escapeHtml(p)}</p>`)
    .join('');

  const placeholderBanner = node.placeholder
    ? `<div class="popup-placeholder">&#9888; This is placeholder data. No real event has been confirmed at this location.</div>`
    : !node.confirmed
      ? `<div class="popup-unconfirmed">&#8505; This event has not been confirmed yet.${node.forum_url ? ` <a href="${escapeHtml(node.forum_url)}" target="_blank" rel="noopener noreferrer">Follow the forum thread</a> for updates.` : ''}</div>`
      : '';

  return `
    <div class="popup-content">
      ${placeholderBanner}
      <h3 class="popup-name">${escapeHtml(node.name)}</h3>
      <p class="popup-date"><strong>${date} &middot; ${location}</strong></p>
      <p class="popup-venue">
        ${ICON_PIN}<a href="${escapeHtml(osmUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(venueText)}</a>
      </p>
      <div class="popup-actions">
        <div class="popup-link-row">
          ${ICON_GLOBE}<a href="${escapeHtml(node.website)}" target="_blank" rel="noopener noreferrer" class="popup-link">Visit event website</a>
        </div>
        <div class="popup-link-row popup-link-row--cal">
          ${ICON_CALENDAR}<a href="${escapeHtml(googleCalUrl)}" target="_blank" rel="noopener noreferrer" class="popup-link">Google Calendar</a>
          <span class="popup-link-sep" aria-hidden="true">&middot;</span>
          ${ICON_CALENDAR}<a href="${icsDataUri}" download="${escapeHtml(node.id)}.ics" class="popup-link">Download .ics</a>
        </div>
        <div class="popup-link-row">
          ${ICON_EMAIL}<a href="mailto:${escapeHtml(node.contact_email)}" class="popup-link">${escapeHtml(node.contact_email)}</a>
        </div>
      </div>
      <div class="popup-body">
        ${descriptionParagraphs}
        <button class="read-more" data-node-id="${escapeHtml(node.id)}">Read more &rarr;</button>
      </div>
    </div>
  `.trim();
}
