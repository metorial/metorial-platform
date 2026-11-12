import { hookDialectFor } from '../../dialects/hooks';
import { sha256Hex } from '../../crypto/keys';
import { normalizeClient } from '../../records/clients';
import { readBody } from '../body';
import { createCollector } from '../emit';
import { invalidClientError, invalidPayloadError } from '../errors';
import { parseJsonObjectBytes, parseTimestamp } from '../payload';
import type { IngestHandler } from '../request';
import { errorResponse, jsonResponse } from '../response';

export let eventIdHeader = 'x-metorial-event-id';
export let observedAtHeader = 'x-metorial-observed-at';

let maxEventIdLength = 128;
let eventIdPattern = /^[A-Za-z0-9_.:-]+$/;

let invalid = (message: string) => errorResponse(invalidPayloadError({ message }));

export let hookHandler: IngestHandler = async request => {
  let client = normalizeClient(request.client ?? '');
  if (!client) return errorResponse(invalidClientError());

  let eventId = request.raw.headers.get(eventIdHeader)?.trim();

  if (eventId && (eventId.length > maxEventIdLength || !eventIdPattern.test(eventId))) {
    return invalid(`The ${eventIdHeader} header is not valid.`);
  }

  let observedHeader = request.raw.headers.get(observedAtHeader)?.trim();
  let observedAt = observedHeader ? parseTimestamp(observedHeader) : null;

  if (observedHeader && !observedAt) {
    return invalid(`The ${observedAtHeader} header must be an RFC 3339 timestamp.`);
  }

  let bytes = await readBody(request.body);
  if (bytes.length == 0) return invalid('The request body is empty.');

  let payload = parseJsonObjectBytes(bytes);
  if (!payload) return invalid('The hook payload must be a JSON object.');

  let identityHint = eventId ? `id:${eventId}` : `body:${sha256Hex(bytes)}`;

  let mapped;

  try {
    mapped = hookDialectFor(client).map({ identityHint }, payload);
  } catch {
    return invalid('The hook payload could not be mapped.');
  }

  let collector = createCollector(request, {
    route: 'hook',
    lane: 'live',
    arrivalIsEventTime: true
  });

  if (!collector.add(mapped, observedAt))
    return invalid('The hook payload could not be mapped.');

  await collector.flush();

  return jsonResponse(200, {});
};
