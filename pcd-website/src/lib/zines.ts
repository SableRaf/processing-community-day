import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import {
  assertIdentity, assertUniqueIds, parseZineMetadata,
  resolveZineAssets, type ZineLicense,
} from './zine-metadata.js';

interface MetadataModule { default: unknown }
type DownloadAsset = string | ImageMetadata;

export interface Zine {
  id: string;
  order: number;
  title: string;
  topic: string;
  tags?: string[];
  languages?: string[];
  created_by: string;
  created_by_url?: string;
  attribution?: string;
  activity_type?: string;
  zine_format?: string;
  duration?: string;
  materials?: string;
  summary: string;
  cover?: { src: ImageMetadata; alt: string };
  downloads: { url: string; filename: string; fileSize: string; role?: 'reader-order' | 'print-ready' }[];
  license?: ZineLicense;
  intake: {
    issue_number: number;
    submitted_by_github: string;
    submitted_date: string;
    maintainer_notes: string;
  };
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
  // Raster image imports need Astro's image metadata so they remain emitted;
  // all non-image downloads are opaque URL assets and bypass inlining.
  const downloadFiles = import.meta.glob<string>('../content/zines/*/downloads/*.{pdf,zip,txt,md,csv,json}', {
    eager: true, import: 'default', query: '?url&no-inline',
  });
  const downloadImages = import.meta.glob<ImageMetadata>('../content/zines/*/downloads/*.{png,jpg,jpeg,webp}', {
    eager: true, import: 'default',
  });
  if (!Object.keys(metadataModules).length && !Object.keys(indexFiles).length) return [];
  const entries = await getCollection('zines');
  const metadataBySlug = filesBySlug(metadataModules);
  const coversBySlug = filesBySlug(covers);
  const downloadsBySlug = filesBySlug<DownloadAsset>({ ...downloadFiles, ...downloadImages });
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
    resolveZineAssets(slug, metadata, {
      covers: [...(coversBySlug.get(slug)?.keys() ?? [])],
      downloads: [...(downloadsBySlug.get(slug)?.keys() ?? [])],
    });
    return { slug, metadata, entry };
  });

  assertUniqueIds(parsed.map(({ metadata }) => metadata));

  return (await Promise.all(parsed.map(async ({ slug, metadata, entry }) => {
    const coverImage = metadata.cover ? coversBySlug.get(slug)?.get(metadata.cover.src) : undefined;
    if (metadata.cover && !coverImage) throw new Error(`Zine "${slug}" cover "${metadata.cover.src}" could not be loaded.`);
    const localFiles = downloadsBySlug.get(slug);
    return {
      ...metadata,
      order: entry.data.order,
      cover: metadata.cover && coverImage
        ? { src: coverImage, alt: metadata.cover.alt }
        : undefined,
      downloads: await Promise.all(metadata.downloads.map(async (download) => {
        if ('url' in download) return {
          url: download.url, filename: download.filename, fileSize: download.file_size, role: download.role,
        };
        const url = localFiles?.get(download.file);
        if (!url) throw new Error(`Zine "${slug}" download "${download.file}" could not be loaded.`);
        if (typeof url === 'string') return { url, filename: download.file, fileSize: download.file_size, role: download.role };
        const format = download.file.endsWith('.jpg') ? 'jpeg' : download.file.split('.').pop() as 'png' | 'jpeg' | 'webp';
        const generated = await getImage({ src: url, format });
        return { url: generated.src, filename: download.file, fileSize: download.file_size, role: download.role };
      })),
      href: `/activity-guide/${metadata.id}/`,
      entry,
    };
  }))).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}
