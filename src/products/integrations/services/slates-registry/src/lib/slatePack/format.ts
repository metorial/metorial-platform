import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v, type ValidationTypeValue } from '@lowerdeck/validation';

export let SLATE_PACK_FORMAT = 'metorial-slatepack';
export let SLATE_PACK_FORMAT_VERSION = 2;
export let SLATE_PACK_MANIFEST_PATH = 'slatepack.json';
export let SLATE_PACK_SIGNATURE_PATH = 'slatepack.sig';
export let SLATE_PACK_SIGNATURE_FORMAT = 'metorial-slatepack-signature';
export let SLATE_PACK_MAX_ENTRIES = 10_000;

export type SlatePackManifestEntry = {
  identifier: string;
  version: string;
  path: string;
  contentChecksum: string | null;
  signatures: { kid: string; signature: string }[];
  catalog: { name: string | null; description: string | null; logoUrl: string | null };
};

export type SlatePackChannelRef = { url: string; subRegistryId: string };

export type SlatePackDelivery =
  | { kind: 'incremental'; channel: SlatePackChannelRef; sequence: number }
  | {
      kind: 'full';
      channel: SlatePackChannelRef;
      fullSyncId: string;
      part: number;
      partCount: number;
      coversSequence: number;
    };

export type SlatePackManifest = {
  format: typeof SLATE_PACK_FORMAT;
  formatVersion: number;
  createdAt: string;
  source: { url: string; subRegistryId: string | null };
  delivery: SlatePackDelivery | null;
  entries: SlatePackManifestEntry[];
};

export type SlatePackSignatures = { kid: string; signature: string }[];

let fullSyncIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

let channelSchema = v.object({ url: v.string(), subRegistryId: v.string() });

let manifestSchema = v.object({
  format: v.literal(SLATE_PACK_FORMAT),
  formatVersion: v.union([v.literal(1), v.literal(2)]),
  createdAt: v.string(),
  source: v.object({ url: v.string(), subRegistryId: v.optional(v.nullable(v.string())) }),
  delivery: v.optional(
    v.nullable(
      v.union([
        v.object({
          kind: v.literal('incremental'),
          channel: channelSchema,
          sequence: v.number({ modifiers: [v.integer(), v.positive()] })
        }),
        v.object({
          kind: v.literal('full'),
          channel: channelSchema,
          fullSyncId: v.string(),
          part: v.number({ modifiers: [v.integer(), v.positive()] }),
          partCount: v.number({ modifiers: [v.integer(), v.positive()] }),
          coversSequence: v.number({ modifiers: [v.integer()] })
        })
      ])
    )
  ),
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

let signatureSchema = v.object({
  format: v.literal(SLATE_PACK_SIGNATURE_FORMAT),
  signatures: v.array(v.object({ kid: v.string(), signature: v.string() }))
});

let invalidPack = (message: string) => new ServiceError(badRequestError({ message }));

export let getSlatePackEntryPath = (d: { identifier: string; version: string }) =>
  `entries/${d.identifier.replace(/^@/, '')}/${d.version}.zip`;

let parseDelivery = (
  delivery: ValidationTypeValue<typeof manifestSchema>['delivery']
): SlatePackDelivery | null => {
  if (!delivery) return null;

  let channel = { url: delivery.channel.url, subRegistryId: delivery.channel.subRegistryId };
  if (delivery.kind === 'incremental') {
    return { kind: 'incremental', channel, sequence: delivery.sequence };
  }

  if (!fullSyncIdPattern.test(delivery.fullSyncId)) {
    throw invalidPack(`${SLATE_PACK_MANIFEST_PATH} has an invalid full sync id.`);
  }
  if (delivery.part > delivery.partCount || delivery.coversSequence < 0) {
    throw invalidPack(`${SLATE_PACK_MANIFEST_PATH} has invalid full sync parts.`);
  }

  return {
    kind: 'full',
    channel,
    fullSyncId: delivery.fullSyncId,
    part: delivery.part,
    partCount: delivery.partCount,
    coversSequence: delivery.coversSequence
  };
};

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
    delivery: result.value.formatVersion >= 2 ? parseDelivery(result.value.delivery) : null,
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

export let serializeSlatePackSignatures = (signatures: SlatePackSignatures) =>
  JSON.stringify({ format: SLATE_PACK_SIGNATURE_FORMAT, signatures }, null, 2);

export let parseSlatePackSignatures = (content: string): SlatePackSignatures => {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw invalidPack(`${SLATE_PACK_SIGNATURE_PATH} is not valid JSON.`);
  }

  let result = signatureSchema.validate(json);
  if (!result.success) throw invalidPack(`${SLATE_PACK_SIGNATURE_PATH} is invalid.`);

  return result.value.signatures;
};
