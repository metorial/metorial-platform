import {
  invalidPayloadError,
  ingestService,
  parseTimestamp
} from '@mtsrc/agent-tracking-module-ingest';
import { readBody } from '../body';
import { ingestCallOf, type IngestHandler } from '../request';
import { errorResponse, jsonResponse } from '../response';

export let eventIdHeader = 'x-metorial-event-id';
export let observedAtHeader = 'x-metorial-observed-at';

let maxEventIdLength = 128;
let eventIdPattern = /^[A-Za-z0-9_.:-]+$/;

let invalid = (message: string) => errorResponse(invalidPayloadError({ message }));

export let hookHandler: IngestHandler = async request => {
  let eventId = request.raw.headers.get(eventIdHeader)?.trim();

  if (eventId && (eventId.length > maxEventIdLength || !eventIdPattern.test(eventId))) {
    return invalid(`The ${eventIdHeader} header is not valid.`);
  }

  let observedHeader = request.raw.headers.get(observedAtHeader)?.trim();
  let observedAt = observedHeader ? parseTimestamp(observedHeader) : null;

  if (observedHeader && !observedAt) {
    return invalid(`The ${observedAtHeader} header must be an RFC 3339 timestamp.`);
  }

  await ingestService.ingestHooks({
    call: ingestCallOf(request),
    client: request.client ?? '',
    eventId,
    observedAt,
    bytes: await readBody(request.body)
  });

  return jsonResponse(200, {});
};
