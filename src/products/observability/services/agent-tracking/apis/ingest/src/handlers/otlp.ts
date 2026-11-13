import { ingestService } from '@mtsrc/agent-tracking-module-ingest';
import { otlpResponse } from '@mtsrc/agent-tracking-otlp';
import { readBody } from '../body';
import { ingestCallOf, type IngestHandler } from '../request';

export let otlpHandler: IngestHandler = async request => {
  let payloadType =
    request.payloadType == 'protobuf' ? ('protobuf' as const) : ('json' as const);

  let result = await ingestService.ingestOtlp({
    call: ingestCallOf(request),
    signal: request.signal,
    payloadType,
    bytes: await readBody(request.body)
  });

  if (result.rejected == 0) return otlpResponse(result.signal, payloadType);

  return otlpResponse(result.signal, payloadType, {
    rejected: result.rejected,
    message: result.message
  });
};
