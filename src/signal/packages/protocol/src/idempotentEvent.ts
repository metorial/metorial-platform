import { createHash } from 'node:crypto';

export type IdempotentEventRequestFingerprintV1Input = {
  tenantId: string;
  senderId: string;
  topics: readonly string[];
  eventType: string;
  payloadJson: string;
  headers: Readonly<Record<string, string>>;
  onlyForDestinations?: readonly string[];
  callbackId?: string | null;
  callbackInstanceId?: string | null;
  callbackSourceId?: string | null;
  callbackTriggerId?: string | null;
};

export class AmbiguousCanonicalHeadersError extends Error {
  constructor() {
    super('Signal event headers are not canonical.');
    this.name = 'AmbiguousCanonicalHeadersError';
  }
}

let canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical event numbers must be finite');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    let record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter(key => record[key] !== undefined)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  throw new Error('Value is outside the canonical JSON data model');
};

export let normalizeIdempotentEventTopics = (topics: readonly string[]) =>
  [...new Set(topics)].sort();

export let normalizeIdempotentEventDestinations = (
  destinations: readonly string[] | undefined
) => (destinations === undefined ? undefined : [...new Set(destinations)].sort());

export let normalizeIdempotentEventHeaders = (headers: Readonly<Record<string, string>>) => {
  let normalized = new Map<string, string>();
  for (let [name, value] of Object.entries(headers)) {
    let key = name.toLowerCase();
    if (!key || normalized.has(key)) throw new AmbiguousCanonicalHeadersError();
    normalized.set(key, value);
  }
  return Object.fromEntries(
    [...normalized.entries()].sort(([first], [second]) => first.localeCompare(second))
  );
};

export let computeIdempotentEventRequestFingerprintV1 = (
  request: IdempotentEventRequestFingerprintV1Input
) => {
  let normalizedHeaders = normalizeIdempotentEventHeaders(request.headers);
  return createHash('sha256')
    .update('metorial.signal-event-request\0v1\0', 'utf8')
    .update(
      canonicalJson({
        tenantId: request.tenantId,
        senderId: request.senderId,
        topics: normalizeIdempotentEventTopics(request.topics),
        eventType: request.eventType,
        // Payload JSON is fingerprinted as its exact UTF-8 representation, not re-serialized.
        payloadJson: request.payloadJson,
        headers: Object.entries(normalizedHeaders),
        onlyForDestinations:
          normalizeIdempotentEventDestinations(request.onlyForDestinations) ?? null,
        callbackId: request.callbackId ?? null,
        callbackInstanceId: request.callbackInstanceId ?? null,
        callbackSourceId: request.callbackSourceId ?? null,
        callbackTriggerId: request.callbackTriggerId ?? null
      }),
      'utf8'
    )
    .digest('hex');
};
