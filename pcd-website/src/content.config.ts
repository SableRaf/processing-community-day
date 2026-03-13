import { defineCollection, z } from 'astro:content';

const events = defineCollection({
  type: 'content',
  schema: z.object({
    id: z.string(),
  }).passthrough(),
});

export const collections = {
  events,
};
