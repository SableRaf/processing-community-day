import type { Node } from './nodes';
import { formatPopupDate } from './format';

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const POPUP_PREVIEW_LENGTH = 120;

function getOsmUrl(node: Node): string {
  const query = node.location_name
    ? [node.location_name, node.address].filter(Boolean).join(', ')
    : node.address ?? '';
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

export function makePopupContent(node: Node): string {
  const date = node.date_tbd
    ? 'Date TBD'
    : escapeHtml(formatPopupDate(node.event_date ?? '', node.event_end_date));

  const rawText = node.event_short_description.trim();
  const blurb = rawText.length > POPUP_PREVIEW_LENGTH
    ? escapeHtml(rawText.slice(0, POPUP_PREVIEW_LENGTH).trimEnd()) + '&hellip;'
    : escapeHtml(rawText);
  const descriptionHtml = blurb ? `<p class="popup-description">${blurb}</p>` : '';

  const placeholderBanner = node.placeholder
    ? `<div class="popup-placeholder">&#9888; This is placeholder data. No real event has been confirmed at this location.</div>`
    : '';

  const organizingEntityHtml = node.organization_name
    ? `<p class="popup-organizing-entity">by ${escapeHtml(node.organization_name)}</p>`
    : '';

  const onlineBadgeHtml = node.online_event ? '<span class="popup-online-badge">Online Event</span>' : '';
  const timeHint = !node.date_tbd && node.time_tbd ? ' · Time TBD' : '';
  const dateLineContent = `${date}${timeHint}`;

  const venueNameHtml = node.online_event
    ? ''
    : node.location_tbd
      ? '<span class="popup-venue-name popup-venue-tbd">Location TBD</span>'
      : node.location_name
        ? `<span class="popup-venue-name">${escapeHtml(node.location_name)}</span>`
        : '';

  const onlineAddressText = node.event_url ? escapeHtml(node.event_url) : 'Online Event';

  const venueAddressHtml = node.online_event
    ? node.event_url
      ? `<a
          href="${escapeHtml(node.event_url)}"
          target="_blank"
          rel="noopener noreferrer"
          class="popup-venue-address"
          title="Join the online event"
        >${onlineAddressText}</a>`
      : `<span class="popup-venue-address">${onlineAddressText}</span>`
    : node.location_tbd
      ? ''
    : node.address
      ? `<a
          href="${escapeHtml(getOsmUrl(node))}"
          target="_blank"
          rel="noopener noreferrer"
          class="popup-venue-address"
          title="Get directions on OpenStreetMap"
        >${escapeHtml(node.address)}</a>`
      : '';

  return `
    <div class="popup-content">
      ${placeholderBanner}
      <div class="popup-header-row">
        <h3 class="popup-name">${escapeHtml(node.event_name)}</h3>
        ${onlineBadgeHtml}
      </div>
      ${organizingEntityHtml}
      <div class="popup-info-card">
        <p class="popup-date">${dateLineContent}</p>
        <div class="popup-venue">
          ${venueNameHtml}
          ${venueAddressHtml}
        </div>
      </div>
      <div class="popup-body">
        ${descriptionHtml}
        <button class="read-more" data-node-id="${escapeHtml(node.id)}">See details &rarr;</button>
      </div>
    </div>
  `.trim();
}
