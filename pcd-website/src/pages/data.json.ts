import type { APIRoute } from 'astro';
import { loadNodes, canonicalEventId } from '../lib/nodes';

export const GET: APIRoute = async ({ site }) => {
  const nodes = await loadNodes();
  const siteUrl = site!.href.replace(/\/$/, '');
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  const events = nodes
    .filter((node) => !node.placeholder)
    .map((node) => ({
      id: node.id,
      uid: node.uid,
      canonical_url: `${siteUrl}${base}/event/${canonicalEventId(node)}/`,
      event_name: node.event_name,
      city: node.city ?? null,
      country: node.country ?? null,
      location_name: node.location_name ?? null,
      address: node.address ?? null,
      location_tbd: node.location_tbd ?? false,
      plus_code: node.plus_code,
      lat: node.lat,
      lng: node.lng,
      event_date: node.event_date ?? null,
      event_end_date: node.event_end_date ?? null,
      event_start_time: node.event_start_time ?? null,
      event_end_time: node.event_end_time ?? null,
      date_tbd: node.date_tbd ?? false,
      time_tbd: node.time_tbd ?? false,
      online_event: node.online_event ?? false,
      event_url: node.event_url ?? null,
      event_page_url: node.event_page_url ?? null,
      event_short_description: node.event_short_description,
      details_text: node.details_text,
      details_html: node.details_html,
      event_activities: node.event_activities,
      organizers: node.organizers,
      organization_name: node.organization_name ?? null,
      organization_url: node.organization_url ?? null,
      organization_type: node.organization_type ?? null,
      forum_thread_url: node.forum_thread_url ?? null,
    }));

  const payload = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    event_count: events.length,
    events,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
