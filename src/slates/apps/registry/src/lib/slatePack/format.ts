import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';

export let SLATE_PACK_FORMAT = 'metorial-slatepack';
export let SLATE_PACK_FORMAT_VERSION = 1;
export let SLATE_PACK_MANIFEST_PATH = 'slatepack.json';
export let SLATE_PACK_MAX_ENTRIES = 10_000;

export type SlatePackManifestEntry = {
  identifier: string;
  version: string;
  path: string;
  contentChecksum: string | null;
  signatures: { kid: string; signature: string }[];
  catalog: { name: string | null; description: string | null; logoUrl: string | null };
};

export type SlatePackManifest = {
  format: typeof SLATE_PACK_FORMAT;
  formatVersion: number;
  createdAt: string;
  source: { url: string; subRegistryId: string | null };
  entries: SlatePackManifestEntry[];
};

let manifestSchema = v.object({
  format: v.literal(SLATE_PACK_FORMAT),
  formatVersion: v.literal(SLATE_PACK_FORMAT_VERSION),
  createdAt: v.string(),
  source: v.object({ url: v.string(), subRegistryId: v.optional(v.nullable(v.string())) }),
  entries: v.array(
    v.object({
      identifier: v.string(),
      version: v.string(),
      path: v.string(),
      contentChecksum: v.optional(v.nullable(v.string())),
      signatures: v.array(v.object({ kid: v.string(), signature: v.string() })),
      catalog: v.optional(
        v.object({
          name: v.optional(v.nullable(v.string())),
          description: v.optional(v.nullable(v.string())),
          logoUrl: v.optional(v.nullable(v.string()))
        })
      )
    })
  )
});

let invalidPack = (message: string) => new ServiceError(badRequestError({ message }));

export let getSlatePackEntryPath = (d: { identifier: string; version: string }) =>
  `entries/${d.identifier.replace(/^@/, '')}/${d.version}.zip`;

export let parseSlatePackManifest = (content: string): SlatePackManifest => {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw invalidPack(`${SLATE_PACK_MANIFEST_PATH} is not valid JSON.`);
  }

  let result = manifestSchema.validate(json);
  if (!result.success) {
    throw invalidPack(
      `${SLATE_PACK_MANIFEST_PATH} is invalid: ${result.errors[0]?.message ?? 'unknown error'}`
    );
  }
  if (result.value.entries.length > SLATE_PACK_MAX_ENTRIES) {
    throw invalidPack(`Slate packs may contain at most ${SLATE_PACK_MAX_ENTRIES} versions.`);
  }

  return {
    format: SLATE_PACK_FORMAT,
    formatVersion: result.value.formatVersion,
    createdAt: result.value.createdAt,
    source: {
      url: result.value.source.url,
      subRegistryId: result.value.source.subRegistryId ?? null
    },
    entries: result.value.entries.map(entry => ({
      identifier: entry.identifier,
      version: entry.version,
      path: entry.path,
      contentChecksum: entry.contentChecksum ?? null,
      signatures: entry.signatures,
      catalog: {
        name: entry.catalog?.name ?? null,
        description: entry.catalog?.description ?? null,
        logoUrl: entry.catalog?.logoUrl ?? null
      }
    }))
  };
};
