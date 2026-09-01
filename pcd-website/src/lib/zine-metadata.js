import { z } from 'astro/zod';

export const LICENSE_URLS = {
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
};

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export const zineMetadataSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase kebab-case'),
  title: z.string().trim().min(1),
  topic: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)).min(1).optional(),
  created_by: z.string().trim().min(1),
  created_by_url: z.string().refine(isHttpUrl, 'must be an http(s) URL').optional(),
  attribution: z.string().trim().min(1).optional(),
  activity_type: z.string().trim().min(1).optional(),
  zine_format: z.string().trim().min(1).optional(),
  duration: z.string().trim().min(1).optional(),
  materials: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1),
  cover: z.object({
    src: z.string().regex(/\.(png|jpg|jpeg|webp)$/, 'must be a lowercase .png/.jpg/.jpeg/.webp'),
    alt: z.string().trim().min(1),
  }).strict().optional(),
  pdfs: z.array(z.union([
    z.object({
      file: z.string().regex(/\.pdf$/, 'must be a lowercase .pdf'),
      label: z.string().trim().min(1),
      file_size: z.string().trim().min(1),
    }).strict(),
    z.object({
      url: z.string().refine(isHttpUrl, 'must be an http(s) URL'),
      label: z.string().trim().min(1),
      filename: z.string().regex(/\.pdf$/, 'must be a lowercase .pdf'),
      file_size: z.string().trim().min(1),
    }).strict(),
  ])).min(1, 'at least one PDF is required'),
  license: z.literal('CC BY-SA 4.0').optional(),
  source_url: z.string().refine(isHttpUrl, 'must be an http(s) URL').optional(),
}).strict();

function formatIssues(error) {
  return error.issues.map((issue) => `${issue.path.join('.') || 'metadata'}: ${issue.message}`).join('; ');
}

export function parseZineMetadata(raw, slug) {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw) && Object.hasOwn(raw, 'draft')) {
    throw new Error(
      `Zine "${slug}" sets \`draft\`, which this collection does not support. ` +
      'src/content/zines/ holds only publishable zines — its assets are emitted to dist/ whether or not a page links them. ' +
      'Move unfinished work to src/content/zines-drafts/ instead.',
    );
  }
  const result = zineMetadataSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid metadata for zine "${slug}": ${formatIssues(result.error)}`);
  }
  if (result.data.id !== slug) {
    throw new Error(`Zine "${slug}" has metadata id "${result.data.id}". Set metadata.id to "${slug}".`);
  }
  return result.data;
}

export function assertIdentity({ slug, frontmatterId, metadataId }) {
  if (slug !== frontmatterId || slug !== metadataId || frontmatterId !== metadataId) {
    throw new Error(
      `Zine identity mismatch: folder slug "${slug}", index.md id "${frontmatterId}", metadata id "${metadataId}". ` +
      'All three values must match.',
    );
  }
}

export function assertUniqueIds(zines) {
  const ids = new Set();
  for (const zine of zines) {
    if (ids.has(zine.id)) throw new Error(`Duplicate zine id "${zine.id}". Every zine folder must have a unique metadata.id.`);
    ids.add(zine.id);
  }
}

export function resolveZineAssets(slug, metadata, availableFiles) {
  const available = new Set(availableFiles);
  const localPdfs = metadata.pdfs.flatMap((pdf) => 'file' in pdf ? [pdf.file] : []);
  const required = [...(metadata.cover ? [metadata.cover.src] : []), ...localPdfs];
  const missing = required.filter((file) => !available.has(file));
  if (missing.length) {
    throw new Error(
      `Zine "${slug}" references missing asset(s): ${missing.join(', ')}. ` +
      `Available files in src/content/zines/${slug}/: ${availableFiles.join(', ') || '(none)'}.`,
    );
  }
  return { cover: metadata.cover?.src, pdfs: localPdfs };
}
