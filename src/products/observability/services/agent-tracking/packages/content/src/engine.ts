import type { ContentEntry, ContentPolicy, ContentRole } from '@mtsrc/agent-tracking-spec';
import { contentHash, type OrganizationKey } from '@mtsrc/agent-tracking-crypto';
import { resolveContentMode } from './policy';
import { computeShape, type ShapeHints } from './shape';

let defaultRedactionMarkers = ['[REDACTED]'];

export let maxFullTextBytes = 64 * 1024;

export type ContentContext = {
  policy: ContentPolicy;
  organizationKey: OrganizationKey;
  redactionMarkers?: string[];
};

export type ContentInput = {
  role: ContentRole;

  value?: unknown;
  clientLength?: number;

  clientTruncated?: { originalLength: number };
  hints?: ShapeHints;
};

let textOf = (value: unknown): string | null => {
  if (typeof value == 'string') return value;

  if (value !== null && typeof value == 'object') {
    try {
      return JSON.stringify(value) ?? null;
    } catch {
      return null;
    }
  }

  if (typeof value == 'number' || typeof value == 'boolean') return String(value);

  return null;
};

let cutToBytes = (text: string, maxBytes: number) => {
  let low = 0;
  let high = Math.min(text.length, maxBytes);

  while (low < high) {
    let middle = Math.ceil((low + high) / 2);

    if (Buffer.byteLength(text.slice(0, middle)) <= maxBytes) low = middle;
    else high = middle - 1;
  }

  let code = text.charCodeAt(low - 1);
  if (low > 0 && code >= 0xd800 && code <= 0xdbff) low--;

  return text.slice(0, low);
};

export let buildContentEntry = (
  context: ContentContext,
  input: ContentInput
): ContentEntry | null => {
  let mode = resolveContentMode(context.policy, input.role);

  let text = textOf(input.value);

  if (text === null || text.length == 0) {
    let size = input.clientLength;

    if (typeof size != 'number' || !Number.isSafeInteger(size) || size <= 0) return null;

    return {
      role: input.role,
      mode,
      state: 'length_only',
      length: { chars: size, source: 'client_reported' }
    };
  }

  let markers = context.redactionMarkers ?? defaultRedactionMarkers;

  if (typeof input.value == 'string' && markers.includes(input.value)) {
    return { role: input.role, mode, state: 'redacted_by_client' };
  }

  let bytes = Buffer.byteLength(text);
  let clientTruncated = input.clientTruncated;

  let entry: ContentEntry = {
    role: input.role,
    mode,
    state: 'present',

    length: clientTruncated
      ? { chars: clientTruncated.originalLength, bytes, source: 'client_reported' }
      : { chars: text.length, bytes, source: 'measured' },

    hash: {
      alg: 'hmac-sha256-128',
      value: contentHash(context.organizationKey, input.role, text),
      basis: clientTruncated ? 'truncated' : 'full'
    }
  };

  if (mode == 'basic') return entry;

  let hints: ShapeHints = { ...input.hints };

  if (input.role == 'tool_input' && hints.input === undefined) hints.input = input.value;

  let shape = computeShape(input.role, text, hints);
  if (shape) entry.shape = shape;

  if (mode == 'shape') return entry;

  if (bytes <= maxFullTextBytes) {
    entry.text = text;
  } else {
    entry.text = cutToBytes(text, maxFullTextBytes);
    entry.truncated = true;
    entry.original_length = text.length;
  }

  if (clientTruncated) {
    entry.truncated = true;
    entry.original_length = clientTruncated.originalLength;
  }

  return entry;
};
