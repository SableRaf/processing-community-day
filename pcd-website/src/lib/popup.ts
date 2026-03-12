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
  const components = [
    node.venue,
    node.address,
    node.city,
    node.country,
  ].filter(Boolean);
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(components.join(', '))}`;
}

export function makePopupContent(node: Node): string {
  const date = node.date_tbd
    ? 'Date TBD'
    : escapeHtml(formatPopupDate(node.start_date ?? '', node.end_date));

  const rawText = node.short_description.trim() || ((node.long_description ?? '').split(/\n\n+/)[0] ?? '');
  const blurb = rawText.length > POPUP_PREVIEW_LENGTH
    ? escapeHtml(rawText.slice(0, POPUP_PREVIEW_LENGTH).trimEnd()) + '&hellip;'
    : escapeHtml(rawText);
  const descriptionHtml = blurb ? `<p class="popup-description">${blurb}</p>` : '';

  const placeholderBanner = node.placeholder
    ? `<div class="popup-placeholder">&#9888; This is placeholder data. No real event has been confirmed at this location.</div>`
    : !node.confirmed
      ? `<div class="popup-unconfirmed">&#8505; This event has not been confirmed yet.${node.forum_url ? ` <a href="${escapeHtml(node.forum_url)}" target="_blank" rel="noopener noreferrer">Follow the forum thread</a> for updates.` : ''}</div>`
      : '';

  const organizingEntityHtml = node.organizing_entity
    ? `<p class="popup-organizing-entity">by ${escapeHtml(node.organizing_entity)}</p>`
    : '';

  const onlineBadgeHtml = node.online ? '<span class="popup-online-badge">Online Event</span>' : '';
  const timeHint = !node.date_tbd && node.time_tbd ? ' · Time TBD' : '';
  const dateLineContent = `${date}${timeHint}`;

  const venueNameHtml = node.online
    ? ''
    : node.location_tbd
      ? '<span class="popup-venue-name popup-venue-tbd">Location TBD</span>'
      : `<span class="popup-venue-name">${escapeHtml(node.venue)}</span>`;

  const onlineAddressText = node.online_url ? escapeHtml(node.online_url) : 'Online Event';

  const venueAddressHtml = node.online
    ? node.online_url
      ? `<a
          href="${escapeHtml(node.online_url)}"
          target="_blank"
          rel="noopener noreferrer"
          class="popup-venue-address"
          title="Join the online event"
        >${onlineAddressText}</a>`
      : `<span class="popup-venue-address">${onlineAddressText}</span>`
    : node.location_tbd
      ? ''
    : `<a
        href="${escapeHtml(getOsmUrl(node))}"
        target="_blank"
        rel="noopener noreferrer"
        class="popup-venue-address"
        title="Get directions on OpenStreetMap"
      >${escapeHtml(node.address || `${node.city}, ${node.country}`)}</a>`;

  return `
    <div class="popup-content">
      ${placeholderBanner}
      <div class="popup-header-row">
        <h3 class="popup-name">${escapeHtml(node.name)}</h3>
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
