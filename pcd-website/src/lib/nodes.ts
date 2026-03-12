import { OpenLocationCode } from 'open-location-code';
import nodesData from '../data/nodes.json';

export interface Node {
  // Identity
  id: string;
  name: string;

  // Location
  city: string;
  country: string;
  region: string;
  venue: string;
  address?: string;
  plus_code: string;
  lat: number;
  lng: number;

  // Event
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  timezone?: string;
  website: string;
  short_description: string;
  long_description?: string;
  tags: string[];
  organizers: string[];
  contact_email: string;
  submitter_email?: string;
  forum_url?: string;
  confirmed: boolean;
  placeholder?: boolean;
}

interface NodeInput {
  id: string;
  name: string;
  city: string;
  country: string;
  region: string;
  venue: string;
  address?: string;
  plus_code: string;
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  timezone?: string;
  website: string;
  short_description: string;
  long_description?: string;
  tags: string[];
  organizers: string[];
  contact_email: string;
  submitter_email?: string;
  forum_url?: string;
  confirmed: boolean;
  placeholder?: boolean;
}

export function loadNodes(): Node[] {
  const olc = new OpenLocationCode();
  const data = nodesData as unknown as { nodes: NodeInput[] };

  return data.nodes.map((input) => {
    if (!olc.isValid(input.plus_code) || !olc.isFull(input.plus_code)) {
      throw new Error(
        `[nodes] Invalid or short plus_code for "${input.id}": "${input.plus_code}".\n` +
        `All plus codes must be full global codes. Look up the full code at https://plus.codes`
      );
    }

    const decoded = olc.decode(input.plus_code);

    return {
      ...input,
      lat: decoded.latitudeCenter,
      lng: decoded.longitudeCenter,
    };
  });
}
