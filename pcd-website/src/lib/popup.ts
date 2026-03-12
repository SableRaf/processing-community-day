import type { Node } from './nodes';
import { formatShortDate, formatTimeRange } from './format';

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const POPUP_PREVIEW_LENGTH = 120;

export function makePopupContent(node: Node): string {
  const date = escapeHtml(formatShortDate(node.start_date));
  const timeStr = node.start_time
    ? ` · ${escapeHtml(formatTimeRange(node.start_time, node.end_time, node.timezone))}`
    : '';

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

  const addressQuery = node.address
    ? `${node.venue}, ${node.address}`
    : `${node.venue}, ${node.city}, ${node.country}`;
  const osmUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(addressQuery)}`;
  const addressText = node.address || `${node.city}, ${node.country}`;

  const organizingEntityHtml = node.organizing_entity
    ? `<p class="popup-organizing-entity">by ${escapeHtml(node.organizing_entity)}</p>`
    : '';

  return `
    <div class="popup-content">
      ${placeholderBanner}
      <h3 class="popup-name">${escapeHtml(node.name)}</h3>
      ${organizingEntityHtml}
      <div class="popup-info-card">
        <p class="popup-date"><strong>${date}${timeStr}</strong></p>
        <p class="popup-venue">
          <span class="popup-venue-name">${escapeHtml(node.venue)}</span>
          <a href="${osmUrl}" target="_blank" rel="noopener noreferrer" class="popup-venue-address" onclick="event.stopPropagation()">${escapeHtml(addressText)}</a>
        </p>
      </div>
      <div class="popup-body">
        ${descriptionHtml}
        <button class="read-more" data-node-id="${escapeHtml(node.id)}">See details &rarr;</button>
      </div>
    </div>
  `.trim();
}
