export type ZineLicense = 'CC BY-SA 4.0';
export declare const LICENSE_URLS: Record<ZineLicense, string>;

export type ZinePdf =
  | { file: string; label: string; file_size: string }
  | { url: string; label: string; filename: string; file_size: string };
export interface ZineMetadata {
  id: string; title: string; topic: string;
  created_by: string; attribution?: string;
  format?: string; duration?: string; materials?: string;
  summary: string; cover?: string; pdfs: ZinePdf[];
  license?: ZineLicense; source_url?: string;
}

export declare const zineMetadataSchema: import('astro/zod').ZodType<ZineMetadata>;
export declare function parseZineMetadata(raw: unknown, slug: string): ZineMetadata;
export declare function assertIdentity(ids: {
  slug: string; frontmatterId: string; metadataId: string;
}): void;
export declare function assertUniqueIds(zines: ZineMetadata[]): void;
export declare function resolveZineAssets(
  slug: string, metadata: ZineMetadata, availableFiles: string[],
): { cover: string | undefined; pdfs: string[] };
