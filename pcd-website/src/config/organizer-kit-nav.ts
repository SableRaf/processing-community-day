import { getCollection, type CollectionEntry } from 'astro:content';

export type KitEntry = CollectionEntry<'organizerKit'>;

export interface KitPage {
  title: string;
  href: string;
  id: string;
}

/** A top-level sidebar node: either a standalone page or a group of pages. */
export type KitNavNode =
  | { kind: 'page'; page: KitPage }
  | { kind: 'group'; title: string; pages: KitPage[] };

export const KIT_BASE = '/organize';

/**
 * The sidebar's top level, in order. A string is a section (the group of pages
 * carrying that `section` in their frontmatter); an object is a standalone page
 * addressed by its entry id.
 *
 * Sections and standalone pages interleave here, so this list is the single
 * place that decides top-level order. Each page's `order` frontmatter only
 * sorts it *within* its section.
 */
const TOP_LEVEL: ReadonlyArray<string | { page: string }> = [
  { page: 'introduction' },
  'Start Here',
  'Planning Your Event',
  'Running Your Event',
  'Communication & Promotion',
  'After the Event',
  { page: 'activity-guides' },
  { page: 'peer-support-sessions' },
  { page: 'documents' },
];

export function kitHref(id: string): string {
  return `${KIT_BASE}/${id}/`;
}

function toPage(entry: KitEntry): KitPage {
  return { title: entry.data.title, href: kitHref(entry.id), id: entry.id };
}

/**
 * Builds the sidebar tree by walking TOP_LEVEL and pulling matching entries out
 * of the collection. Throws if an entry exists that TOP_LEVEL never places, so
 * adding a Markdown file without listing it here fails the build rather than
 * silently producing an unreachable page.
 */
export async function getKitNav(): Promise<KitNavNode[]> {
  const allEntries = await getCollection('organizerKit');
  const entries = allEntries.filter((entry) => !entry.data.draft);
  const allIds = new Set(allEntries.map((entry) => entry.id));

  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const bySection = new Map<string, KitEntry[]>();
  for (const entry of entries) {
    const section = entry.data.section;
    if (!section) continue;
    const list = bySection.get(section);
    if (list) list.push(entry);
    else bySection.set(section, [entry]);
  }

  const placed = new Set<string>();
  const nodes: KitNavNode[] = [];

  for (const slot of TOP_LEVEL) {
    if (typeof slot === 'string') {
      const sectionEntries = bySection.get(slot);
      if (!sectionEntries?.length) {
        throw new Error(
          `Organizer Kit section "${slot}" is listed in TOP_LEVEL but no content entry declares it. ` +
            `Check the \`section\` frontmatter in src/content/organizer-kit/.`,
        );
      }
      const pages = [...sectionEntries].sort((a, b) => a.data.order - b.data.order);
      for (const entry of pages) placed.add(entry.id);
      nodes.push({ kind: 'group', title: slot, pages: pages.map(toPage) });
    } else {
      const entry = byId.get(slot.page);
      if (!entry) {
        if (allIds.has(slot.page)) continue; // draft — omit from the sidebar
        throw new Error(
          `Organizer Kit page "${slot.page}" is listed in TOP_LEVEL but src/content/organizer-kit/${slot.page}.md does not exist.`,
        );
      }
      placed.add(entry.id);
      nodes.push({ kind: 'page', page: toPage(entry) });
    }
  }

  const orphans = entries.filter((entry) => !placed.has(entry.id));
  if (orphans.length) {
    throw new Error(
      `Organizer Kit entries are missing from the sidebar: ${orphans.map((e) => e.id).join(', ')}. ` +
        `Add each to TOP_LEVEL in src/config/organizer-kit-nav.ts (as a { page } slot, or give it a \`section\` that TOP_LEVEL lists).`,
    );
  }

  return nodes;
}

/** Flattened reading order, used for prev/next links. */
export function flattenKitNav(nodes: KitNavNode[]): KitPage[] {
  return nodes.flatMap((node) => (node.kind === 'page' ? [node.page] : node.pages));
}
