export type ZineLicense = 'CC BY-SA 4.0';
export declare const LICENSE_URLS: Record<ZineLicense, string>;

export type ZineDownload =
  | { file: string; file_size: string; role?: 'reader-order' | 'print-ready' }
  | { url: string; filename: string; file_size: string; role?: 'reader-order' | 'print-ready' };
export interface ZineCover {
  src: string;
  alt: string;
}
export interface ZineMetadata {
  id: string; title: string; topic: string;
  tags?: string[]; languages?: string[];
  created_by: string; created_by_url?: string; attribution?: string;
  activity_type?: string; zine_format?: string;
  duration?: string; materials?: string;
  summary: string; cover?: ZineCover; downloads: ZineDownload[];
  license?: ZineLicense;
  intake: {
    issue_number: number;
    submitted_by_github: string;
    submitted_date: string;
    maintainer_notes: string;
  };
}

export declare const zineMetadataSchema: import('astro/zod').ZodType<ZineMetadata>;
export declare function parseZineMetadata(raw: unknown, slug: string): ZineMetadata;
export declare function assertIdentity(ids: {
  slug: string; frontmatterId: string; metadataId: string;
}): void;
export declare function assertUniqueIds(zines: ZineMetadata[]): void;
export declare function resolveZineAssets(
  slug: string, metadata: ZineMetadata,
  availableAssets: { covers: string[]; downloads: string[] },
): { cover: string | undefined; downloads: string[] };
