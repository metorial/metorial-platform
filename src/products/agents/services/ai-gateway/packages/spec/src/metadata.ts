import { v } from '@lowerdeck/validation';

export let maxRequestMetadataEntries = 20;

export let maxRequestMetadataKeyLength = 64;

export let maxRequestMetadataValueLength = 256;

export let requestMetadataHeader = 'x-metorial-metadata';

export let requestMetadataSchema = v.record(
  v.string({ modifiers: [v.maxLength(maxRequestMetadataValueLength)] })
);

export type RequestMetadata = Record<string, string>;

export let parseRequestMetadata = (
  raw: string | undefined
): { metadata: RequestMetadata } | { error: string } => {
  if (!raw?.trim()) return { metadata: {} };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: `The ${requestMetadataHeader} header must be a JSON object.` };
  }

  let parsed = requestMetadataSchema.validate(json);
  if (!parsed.success || !json || typeof json != 'object' || Array.isArray(json)) {
    return {
      error: `The ${requestMetadataHeader} header must be a JSON object of strings up to ${maxRequestMetadataValueLength} characters.`
    };
  }

  let entries = Object.entries(parsed.value as RequestMetadata);
  if (entries.length > maxRequestMetadataEntries) {
    return {
      error: `The ${requestMetadataHeader} header can hold at most ${maxRequestMetadataEntries} entries.`
    };
  }
  if (entries.some(([key]) => !key || key.length > maxRequestMetadataKeyLength)) {
    return {
      error: `Keys in the ${requestMetadataHeader} header must be 1 to ${maxRequestMetadataKeyLength} characters.`
    };
  }

  return { metadata: Object.fromEntries(entries) };
};
