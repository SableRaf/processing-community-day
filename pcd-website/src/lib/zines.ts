import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';
import {
  assertIdentity, assertUniqueIds, parseZineMetadata,
  resolveZineAssets, type ZineLicense,
} from './zine-metadata.js';

interface MetadataModule { default: unknown }

export interface Zine {
  id: string;
  order: number;
  title: string;
  topic: string;
  tags?: string[];
  created_by: string;
  created_by_url?: string;
  attribution?: string;
  activity_type?: string;
  zine_format?: string;
  duration?: string;
  materials?: string;
  summary: string;
  cover?: { src: ImageMetadata; alt: string };
  pdfs: { url: string; label: string; filename: string; fileSize: string }[];
  license?: ZineLicense;
  source_url?: string;
  href: string;
  entry: CollectionEntry<'zines'>;
}

function filename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function slugFromPath(path: string): string {
  const match = path.match(/zines\/([^/]+)\//);
  if (!match) throw new Error(`Could not determine zine folder from asset path "${path}".`);
  return match[1];
}

function filesBySlug<T>(modules: Record<string, T>): Map<string, Map<string, T>> {
  const output = new Map<string, Map<string, T>>();
  for (const [path, value] of Object.entries(modules)) {
    const slug = slugFromPath(path);
    const files = output.get(slug) ?? new Map<string, T>();
    files.set(filename(path), value);
    output.set(slug, files);
  }
  return output;
}

export async function loadZines(): Promise<Zine[]> {
  const metadataModules = import.meta.glob<MetadataModule>('../content/zines/*/metadata.json', { eager: true });
  // Avoid asking Astro for an empty collection: its loader emits a misleading
  // "collection does not exist" warning in the intended zero-zine state.
  const indexFiles = import.meta.glob('../content/zines/*/index.md', { eager: true, query: '?raw', import: 'default' });
  const covers = import.meta.glob<ImageMetadata>('../content/zines/*/*.{png,jpg,jpeg,webp}', {
    eager: true, import: 'default',
  });
  const pdfs = import.meta.glob<string>('../content/zines/*/*.pdf', {
    eager: true, import: 'default', query: '?url&no-inline',
  });
  if (!Object.keys(metadataModules).length && !Object.keys(indexFiles).length) return [];
  const entries = await getCollection('zines');
  const metadataBySlug = filesBySlug(metadataModules);
  const coversBySlug = filesBySlug(covers);
  const pdfsBySlug = filesBySlug(pdfs);
  const entriesBySlug = new Map(entries.map((entry) => [entry.id, entry]));

  for (const slug of metadataBySlug.keys()) {
    if (!entriesBySlug.has(slug)) {
      throw new Error(`Zine "${slug}" has metadata.json but no sibling index.md. Add src/content/zines/${slug}/index.md.`);
    }
  }
  for (const entry of entries) {
    if (entry.data.id !== entry.id) {
      throw new Error(`Zine folder "${entry.id}" has frontmatter id "${entry.data.id}". Set id to "${entry.id}".`);
    }
  }
  for (const slug of entriesBySlug.keys()) {
    if (!metadataBySlug.has(slug)) {
      throw new Error(`Zine "${slug}" has index.md but no sibling metadata.json. Add src/content/zines/${slug}/metadata.json.`);
    }
  }

  const parsed = [...metadataBySlug.entries()].map(([slug, modules]) => {
    const metadataModule = modules.get('metadata.json');
    if (!metadataModule) throw new Error(`Zine "${slug}" is missing metadata.json.`);
    const metadata = parseZineMetadata(metadataModule.default, slug);
    const entry = entriesBySlug.get(slug)!;
    assertIdentity({ slug, frontmatterId: entry.data.id, metadataId: metadata.id });
    const availableFiles = [...(coversBySlug.get(slug)?.keys() ?? []), ...(pdfsBySlug.get(slug)?.keys() ?? [])];
    resolveZineAssets(slug, metadata, availableFiles);
    return { slug, metadata, entry };
  });

  assertUniqueIds(parsed.map(({ metadata }) => metadata));

  return parsed.map(({ slug, metadata, entry }) => {
    const coverImage = metadata.cover ? coversBySlug.get(slug)?.get(metadata.cover.src) : undefined;
    if (metadata.cover && !coverImage) throw new Error(`Zine "${slug}" cover "${metadata.cover.src}" could not be loaded.`);
    const pdfFiles = pdfsBySlug.get(slug);
    return {
      ...metadata,
      order: entry.data.order,
      cover: metadata.cover && coverImage
        ? { src: coverImage, alt: metadata.cover.alt }
        : undefined,
      pdfs: metadata.pdfs.map((pdf) => {
        if ('url' in pdf) return {
          url: pdf.url, label: pdf.label, filename: pdf.filename, fileSize: pdf.file_size,
        };
        const url = pdfFiles?.get(pdf.file);
        if (!url) throw new Error(`Zine "${slug}" PDF "${pdf.file}" could not be loaded.`);
        return { url, label: pdf.label, filename: pdf.file, fileSize: pdf.file_size };
      }),
      href: `/activity-guide/${metadata.id}/`,
      entry,
    };
  }).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}
