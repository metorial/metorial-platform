import type { OtlpSignal } from '@metorial/groundstation-spec';
import { assertIngestAllowed, isClientAllowed } from '../../auth/principal';
import { clientNotAllowedError } from '../../auth/errors';
import { otlpChannel } from '../../dialects/otlp/common';
import { mapOtlpDecoded } from '../../dialects/registry';
import { decodeOtlp, OtlpDecodeError, otlpLimits, otlpResponse } from '../../otlp';
import { readBody } from '../body';
import { createCollector } from '../emit';
import { invalidPayloadError, tooManyItemsError } from '../errors';
import { parseJsonObjectBytes } from '../payload';
import type { IngestHandler } from '../request';
import { errorResponse } from '../response';

let signalByRootKey: Record<string, OtlpSignal> = {
  resourceLogs: 'logs',
  resourceMetrics: 'metrics',
  resourceSpans: 'traces'
};

let invalid = (message: string) => errorResponse(invalidPayloadError({ message }));

let inferSignal = (bytes: Uint8Array): OtlpSignal | null => {
  let root = parseJsonObjectBytes(bytes);
  if (!root) return null;

  let present = Object.keys(signalByRootKey).filter(key => Object.hasOwn(root, key));

  return present.length == 1 ? signalByRootKey[present[0]!]! : null;
};

export let otlpHandler: IngestHandler = async request => {
  let payloadType: 'protobuf' | 'json' =
    request.payloadType == 'protobuf' ? 'protobuf' : 'json';
  let bytes = await readBody(request.body);

  let signal = request.signal;

  if (!signal) {
    if (payloadType != 'json') {
      return invalid('Protobuf payloads must be sent to /v1/logs, /v1/metrics or /v1/traces.');
    }

    signal = inferSignal(bytes) ?? undefined;

    if (!signal) {
      return invalid(
        'The payload must contain exactly one of resourceLogs, resourceMetrics or resourceSpans.'
      );
    }

    let denied = assertIngestAllowed(request.principal, { channel: otlpChannel(signal) });
    if (denied) return errorResponse(denied);
  }

  let decoded;

  try {
    decoded = decodeOtlp(signal, payloadType, bytes);
  } catch (error) {
    if (error instanceof OtlpDecodeError) {
      return invalid(`The OTLP payload could not be decoded: ${error.message}.`);
    }

    throw error;
  }

  if (decoded.itemCount > otlpLimits.maxItems) return errorResponse(tooManyItemsError());

  let mapped = mapOtlpDecoded(signal, decoded);
  let collector = createCollector(request, { route: 'otlp_http', lane: 'live' });

  let notAllowed = 0;
  let unbuildable = 0;

  mapped.groups.forEach((group, index) => {
    if (!isClientAllowed(request.principal, group.dialect.client)) {
      notAllowed += decoded.groups[index]!.items.length;
      return;
    }

    for (let entry of group.mapped) {
      if (!collector.add([entry])) unbuildable++;
    }
  });

  if (notAllowed > 0 && notAllowed == decoded.itemCount) {
    return errorResponse(clientNotAllowedError());
  }

  await collector.flush();

  let rejected = decoded.malformed + mapped.failed + notAllowed + unbuildable;

  if (rejected == 0) return otlpResponse(signal, payloadType);

  let reasons = [
    decoded.malformed > 0 ? `${decoded.malformed} malformed` : '',
    mapped.failed + unbuildable > 0
      ? `${mapped.failed + unbuildable} could not be mapped`
      : '',
    notAllowed > 0 ? `${notAllowed} for clients this token may not use` : ''
  ].filter(Boolean);

  return otlpResponse(signal, payloadType, {
    rejected,
    message: `Rejected: ${reasons.join(', ')}.`
  });
};
