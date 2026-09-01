import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const events = defineCollection({
  type: 'content',
  schema: z.object({
    id: z.string(),
    uid: z.string().regex(/^[0-9a-f]{7}$/),
  }).passthrough(),
});

// Declared explicitly. Adding any `loader: glob()` collection below switches off
// Astro's orphaned-collection fallback, which is what used to expose
// src/content/legal/ without a declaration. Without this, /privacy/, /terms/
// and /trademark/ would 404 with no build error.
const legal = defineCollection({
  loader: glob({ base: './src/content/legal', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
  }),
});

const organizerKit = defineCollection({
  loader: glob({ base: './src/content/organizer-kit', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    // Sidebar grouping. `section` is the parent group's title; standalone
    // top-level pages omit it. `order` sorts a page within its section — the
    // top level's own order comes from TOP_LEVEL in config/organizer-kit-nav.ts.
    section: z.string().optional(),
    order: z.number().default(0),
    description: z.string().optional(),
    // Excludes the page from the sidebar and from build output entirely, for
    // TBD pages that shouldn't be publicly reachable yet.
    draft: z.boolean().default(false),
  }),
});

const zines = defineCollection({
  // One flat folder per zine. `index.md` makes the collection entry id the
  // folder slug; `content.md` would instead produce `<slug>/content`.
  loader: glob({ base: './src/content/zines', pattern: '*/index.md' }),
  schema: z.object({
    id: z.string(),
    order: z.number().int().nonnegative(),
  }),
});

export const collections = {
  events,
  legal,
  organizerKit,
  zines,
};
