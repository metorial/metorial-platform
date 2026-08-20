import { createHash } from 'node:crypto';
import {
  canonicalizeJsonJcs,
  computeDispatchWebhookRequestHash,
  computeOriginalWebhookRequestHash,
  parseWebhookWireRequest,
  type SlateWebhookItemAdapterId,
  type WebhookWireRequest
} from '@slates/proto';

export let MAX_GRAPH_WEBHOOK_CANDIDATES = 1000;
export let MAX_GRAPH_WEBHOOK_JSON_DEPTH = 64;

export type WebhookItemCandidate = Readonly<{
  candidateId: string;
  index: number;
  bindingHash: string;
  deliveryIds: readonly string[];
}>;

type ParsedGraphBody = {
  source: string;
  values: Record<string, unknown>[];
  array: {
    items: { start: number; end: number; raw: string }[];
    contentStart: number;
    contentEnd: number;
  };
};

export type PreparedWebhookItemAdapter = Readonly<{
  id: 'graph.body_value.v1';
  candidates: readonly WebhookItemCandidate[];
  originalRequestHash: string;
  reconstruct(acceptedCandidateIds: readonly string[]): {
    request: WebhookWireRequest;
    selected: readonly WebhookItemCandidate[];
    dispatchRequestHash: string;
  };
}>;

let sha256 = (value: Uint8Array | string) =>
  createHash('sha256').update(value).digest('hex');

let readJsonBodyText = (request: WebhookWireRequest) => {
  if (!request.body.present) throw new Error('Graph webhook body is absent');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(
      Buffer.from(request.body.base64, 'base64')
    );
  } catch {
    throw new Error('Graph webhook body is not valid UTF-8');
  }
};

let skipJsonWhitespace = (source: string, start: number) => {
  let index = start;
  while (index < source.length && /[\t\n\r ]/.test(source[index]!)) index += 1;
  return index;
};

let scanJsonStringEnd = (source: string, start: number) => {
  if (source[start] !== '"') throw new Error('Graph webhook JSON string is invalid');
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    let character = source[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === '"') return index + 1;
  }
  throw new Error('Graph webhook JSON string is unterminated');
};

let scanJsonValueEnd = (source: string, start: number, depth = 0): number => {
  if (depth > MAX_GRAPH_WEBHOOK_JSON_DEPTH) {
    throw new Error('Graph webhook JSON exceeds the nesting bound');
  }
  let index = skipJsonWhitespace(source, start);
  let initial = source[index];
  if (initial === '"') return scanJsonStringEnd(source, index);
  if (initial === '[') {
    index = skipJsonWhitespace(source, index + 1);
    if (source[index] === ']') return index + 1;
    while (index < source.length) {
      index = skipJsonWhitespace(source, scanJsonValueEnd(source, index, depth + 1));
      if (source[index] === ']') return index + 1;
      if (source[index] !== ',') throw new Error('Graph webhook JSON array is invalid');
      index = skipJsonWhitespace(source, index + 1);
    }
  }
  if (initial === '{') {
    index = skipJsonWhitespace(source, index + 1);
    if (source[index] === '}') return index + 1;
    while (index < source.length) {
      let keyEnd = scanJsonStringEnd(source, index);
      index = skipJsonWhitespace(source, keyEnd);
      if (source[index] !== ':') throw new Error('Graph webhook JSON object is invalid');
      index = skipJsonWhitespace(source, scanJsonValueEnd(source, index + 1, depth + 1));
      if (source[index] === '}') return index + 1;
      if (source[index] !== ',') throw new Error('Graph webhook JSON object is invalid');
      index = skipJsonWhitespace(source, index + 1);
    }
  }
  let scalarStart = index;
  while (index < source.length && !/[\t\n\r ,\]}]/.test(source[index]!)) index += 1;
  if (index === scalarStart) throw new Error('Graph webhook JSON value is invalid');
  return index;
};

let scanJsonArrayItems = (source: string, arrayStart: number) => {
  let index = skipJsonWhitespace(source, arrayStart + 1);
  let items: { start: number; end: number; raw: string }[] = [];
  if (source[index] === ']') {
    return { items, contentStart: arrayStart + 1, contentEnd: index };
  }
  while (index < source.length) {
    let itemStart = index;
    let itemEnd = scanJsonValueEnd(source, itemStart);
    items.push({ start: itemStart, end: itemEnd, raw: source.slice(itemStart, itemEnd) });
    index = skipJsonWhitespace(source, itemEnd);
    if (source[index] === ']') {
      return { items, contentStart: arrayStart + 1, contentEnd: index };
    }
    if (source[index] !== ',') throw new Error('Graph webhook JSON array is invalid');
    index = skipJsonWhitespace(source, index + 1);
  }
  throw new Error('Graph webhook JSON array is unterminated');
};

let locateGraphValueArray = (source: string) => {
  let index = skipJsonWhitespace(source, 0);
  if (source[index] !== '{') throw new Error('Graph webhook JSON root must be an object');
  index = skipJsonWhitespace(source, index + 1);
  let located: ReturnType<typeof scanJsonArrayItems> | null = null;
  while (index < source.length && source[index] !== '}') {
    let keyEnd = scanJsonStringEnd(source, index);
    let key: unknown;
    try {
      key = JSON.parse(source.slice(index, keyEnd));
    } catch {
      throw new Error('Graph webhook JSON key is invalid');
    }
    index = skipJsonWhitespace(source, keyEnd);
    if (source[index] !== ':') throw new Error('Graph webhook JSON object is invalid');
    let valueStart = skipJsonWhitespace(source, index + 1);
    let valueEnd = scanJsonValueEnd(source, valueStart);
    if (key === 'value') {
      if (located || source[valueStart] !== '[') {
        throw new Error('Graph webhook body.value is invalid');
      }
      located = scanJsonArrayItems(source, valueStart);
    }
    index = skipJsonWhitespace(source, valueEnd);
    if (source[index] === '}') break;
    if (source[index] !== ',') throw new Error('Graph webhook JSON object is invalid');
    index = skipJsonWhitespace(source, index + 1);
  }
  if (!located) throw new Error('Graph webhook body.value is missing');
  return located;
};

let parseGraphBody = (request: WebhookWireRequest): ParsedGraphBody => {
  let source = readJsonBodyText(request);
  let root: unknown;
  try {
    root = JSON.parse(source);
  } catch {
    throw new Error('Graph webhook body is not valid JSON');
  }
  if (typeof root !== 'object' || root === null || Array.isArray(root)) {
    throw new Error('Graph webhook JSON root must be an object');
  }
  let values = (root as Record<string, unknown>).value;
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.length > MAX_GRAPH_WEBHOOK_CANDIDATES ||
    values.some(value => typeof value !== 'object' || value === null || Array.isArray(value))
  ) {
    throw new Error('Graph webhook candidate list is invalid');
  }
  let array = locateGraphValueArray(source);
  if (array.items.length !== values.length) {
    throw new Error('Graph webhook candidate list is contradictory');
  }
  return { source, values: values as Record<string, unknown>[], array };
};

let graphCandidates = (parsed: ParsedGraphBody) =>
  Object.freeze(
    parsed.values.map((value, index) => {
      let rawItem = parsed.array.items[index]!.raw;
      let itemDigest = sha256(new TextEncoder().encode(rawItem));
      let bindingHash = sha256(
        new TextEncoder().encode(
          canonicalizeJsonJcs({
            adapterId: 'graph.body_value.v1',
            index,
            binding: {
              subscriptionId: value.subscriptionId ?? null,
              clientState: value.clientState ?? null,
              resource: value.resource ?? null,
              itemDigest
            }
          })
        )
      );
      let explicitDeliveryIds = [value.id, value.changeId, value.sequenceNumber].filter(
        (entry): entry is string => typeof entry === 'string' && entry.length > 0
      );
      return Object.freeze({
        candidateId: `graph.body_value.v1:${index}:${bindingHash.slice(0, 16)}`,
        index,
        bindingHash,
        deliveryIds: Object.freeze(
          explicitDeliveryIds.length > 0
            ? [...new Set(explicitDeliveryIds)]
            : [`sha256:${itemDigest}`]
        )
      });
    })
  );

let prepareGraphBodyValueV1 = (request: WebhookWireRequest): PreparedWebhookItemAdapter => {
  let parsedRequest = parseWebhookWireRequest(request);
  let parsed = parseGraphBody(parsedRequest);
  let candidates = graphCandidates(parsed);
  let originalRequestHash = computeOriginalWebhookRequestHash(parsedRequest);
  return Object.freeze({
    id: 'graph.body_value.v1' as const,
    candidates,
    originalRequestHash,
    reconstruct: (acceptedCandidateIds: readonly string[]) => {
      let validation = validateSelectedWebhookCandidates({
        candidates,
        acceptedCandidateIds
      });
      if (validation.status === 'rejected') throw new Error(validation.code);
      let accepted = new Set(acceptedCandidateIds);
      let selected = Object.freeze(
        candidates.filter(candidate => accepted.has(candidate.candidateId))
      );
      let reconstructed = parsedRequest;
      if (selected.length !== candidates.length) {
        let acceptedItems = selected.map(candidate => parsed.array.items[candidate.index]!.raw);
        let replaceStart = parsed.array.items[0]?.start ?? parsed.array.contentStart;
        let replaceEnd = parsed.array.items.at(-1)?.end ?? parsed.array.contentEnd;
        let source =
          parsed.source.slice(0, replaceStart) +
          acceptedItems.join(',') +
          parsed.source.slice(replaceEnd);
        reconstructed = parseWebhookWireRequest({
          ...parsedRequest,
          body: {
            present: true,
            base64: Buffer.from(source, 'utf8').toString('base64')
          }
        });
      }
      return {
        request: reconstructed,
        selected,
        dispatchRequestHash: computeDispatchWebhookRequestHash(reconstructed)
      };
    }
  });
};

let WEBHOOK_ITEM_ADAPTERS = Object.freeze({
  'graph.body_value.v1': prepareGraphBodyValueV1
} satisfies Record<
  SlateWebhookItemAdapterId,
  (request: WebhookWireRequest) => PreparedWebhookItemAdapter
>);

export let prepareWebhookItemAdapter = (
  id: SlateWebhookItemAdapterId,
  request: WebhookWireRequest
) => {
  let adapter = WEBHOOK_ITEM_ADAPTERS[id];
  if (!adapter) throw new Error('Unknown webhook item adapter');
  return adapter(parseWebhookWireRequest(request));
};

export let validateSelectedWebhookCandidates = (d: {
  candidates: readonly WebhookItemCandidate[];
  acceptedCandidateIds: readonly string[];
}) => {
  if (new Set(d.acceptedCandidateIds).size !== d.acceptedCandidateIds.length) {
    return { status: 'rejected' as const, code: 'item_candidate_duplicate' as const };
  }
  let known = new Map(d.candidates.map(candidate => [candidate.candidateId, candidate]));
  if (d.acceptedCandidateIds.some(candidateId => !known.has(candidateId))) {
    return { status: 'rejected' as const, code: 'item_candidate_unknown' as const };
  }
  if (d.acceptedCandidateIds.length === 0) {
    return { status: 'rejected' as const, code: 'credential_invalid' as const };
  }
  return { status: 'accepted' as const };
};
