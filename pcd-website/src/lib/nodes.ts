import { getCollection } from 'astro:content';
import { OpenLocationCode } from 'open-location-code';

export function canonicalEventId(node: Pick<Node, 'id' | 'uid'>): string {
  return `${node.id}-${node.uid}`;
}

export interface Node {
  // Identity
  id: string;
  uid: string;
  event_name: string;

  // Location
  city?: string;
  country?: string;
  location_name?: string;
  address?: string;
  location_tbd?: boolean;
  plus_code: string;
  lat: number;
  lng: number;

  // Event
  event_date?: string;
  event_end_date?: string;
  event_start_time?: string;
  event_end_time?: string;
  date_tbd?: boolean;
  time_tbd?: boolean;
  online_event?: boolean;
  event_url?: string;
  event_page_url?: string;
  event_short_description: string;
  details_markdown: string;
  details_text: string;
  event_activities: string[];
  organizers: { name: string }[];
  organization_name?: string;
  organization_url?: string;
  organization_type?: string;
  primary_contact: { name: string; email: string };
  forum_thread_url?: string;
  placeholder?: boolean;
}

interface NodeInput {
  id: string;
  uid?: string;
  organizers: { name: string }[];
  primary_contact: { name: string; email: string };
  organization_name?: string;
  organization_url?: string;
  organization_type?: string;
  online_event?: boolean;
  event_url?: string;
  event_name: string;
  event_location: { name?: string; address?: string; plus_code: string };
  event_date?: string;
  event_end_date?: string;
  event_start_time?: string;
  event_end_time?: string;
  event_short_description: string;
  event_activities: string[];
  event_page_url?: string;
  forum_thread_url?: string;
  city?: string;
  country?: string;
  placeholder?: boolean;
  intake?: {
    issue_number?: number;
    submitted_by_github?: string;
    submitted_date?: string;
    maintainer_notes?: string;
  };
}

interface MetadataModule {
  default: NodeInput;
}

function normalizeOptionalText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function markdownToText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .trim();
}

export async function loadNodes(): Promise<Node[]> {
  const olc = new OpenLocationCode();
  const eventEntries = await getCollection('events');
  const eventMap = new Map(eventEntries.map((entry) => [entry.data.id, entry]));
  const metadataModules = import.meta.glob<MetadataModule>('../content/events/**/metadata.json', {
    eager: true,
  });
  const inputs = Object.values(metadataModules).map((module) => module.default);

  return inputs.map((input) => {
    const plusCode = input.event_location.plus_code.trim().toUpperCase();

    if (!olc.isValid(plusCode) || !olc.isFull(plusCode)) {
      throw new Error(
        `[nodes] Invalid or short plus_code for "${input.id}": "${plusCode}".\n` +
        `All plus codes must be full global codes. Look up the full code at https://plus.codes`
      );
    }

    const decoded = olc.decode(plusCode);
    const location_name = normalizeOptionalText(input.event_location.name);
    const address = normalizeOptionalText(input.event_location.address);
    const event_date = normalizeOptionalText(input.event_date);
    const event_end_date = normalizeOptionalText(input.event_end_date);
    const event_start_time = normalizeOptionalText(input.event_start_time);
    const event_end_time = normalizeOptionalText(input.event_end_time);
    const online_event = input.online_event ?? false;
    const location_tbd = !online_event && !address;
    const eventEntry = eventMap.get(input.id);
    const details_markdown = normalizeOptionalText(eventEntry?.body) ?? '';
    const details_text = markdownToText(details_markdown);

    return {
      id: input.id,
      uid: input.uid ?? input.id,
      event_name: input.event_name,
      city: normalizeOptionalText(input.city),
      country: normalizeOptionalText(input.country),
      location_name,
      address,
      location_tbd,
      plus_code: plusCode,
      lat: decoded.latitudeCenter,
      lng: decoded.longitudeCenter,
      event_date,
      event_end_date,
      event_start_time,
      event_end_time,
      date_tbd: !event_date,
      time_tbd: !!event_date && !event_start_time,
      online_event,
      event_url: normalizeOptionalText(input.event_url),
      event_page_url: normalizeOptionalText(input.event_page_url),
      event_short_description: input.event_short_description,
      details_markdown,
      details_text,
      event_activities: input.event_activities,
      organizers: input.organizers,
      organization_name: normalizeOptionalText(input.organization_name),
      organization_url: normalizeOptionalText(input.organization_url),
      organization_type: normalizeOptionalText(input.organization_type),
      primary_contact: input.primary_contact,
      forum_thread_url: normalizeOptionalText(input.forum_thread_url),
      placeholder: input.placeholder,
    };
  }).sort((a, b) => {
    const byDate = (a.event_date ?? '').localeCompare(b.event_date ?? '');
    if (byDate !== 0) return byDate;
    return a.event_name.localeCompare(b.event_name);
  });
}
