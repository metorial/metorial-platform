import type { OtlpSignal } from '@mtsrc/agent-tracking-spec';

type Partial = { rejected: number; message?: string };

let rejectedFields: Record<OtlpSignal, { json: string; field: number }> = {
  logs: { json: 'rejectedLogRecords', field: 1 },
  metrics: { json: 'rejectedDataPoints', field: 1 },
  traces: { json: 'rejectedSpans', field: 1 }
};

let varint = (value: number) => {
  let bytes: number[] = [];
  let remaining = BigInt(Math.max(0, Math.trunc(value)));

  while (remaining >= 0x80n) {
    bytes.push(Number(remaining & 0x7fn) | 0x80);
    remaining >>= 7n;
  }

  bytes.push(Number(remaining));

  return bytes;
};

let lengthDelimited = (field: number, payload: Uint8Array) =>
  Uint8Array.from([...varint((field << 3) | 2), ...varint(payload.length), ...payload]);

export let encodeExportResponse = (signal: OtlpSignal, partial?: Partial): Uint8Array => {
  if (!partial || partial.rejected <= 0) return new Uint8Array();

  let parts: number[] = [
    ...varint((rejectedFields[signal].field << 3) | 0),
    ...varint(partial.rejected)
  ];

  if (partial.message) {
    parts.push(...lengthDelimited(2, new TextEncoder().encode(partial.message)));
  }

  return lengthDelimited(1, Uint8Array.from(parts));
};

export let otlpResponse = (
  signal: OtlpSignal,
  payloadType: 'protobuf' | 'json',
  partial?: Partial
): Response => {
  if (payloadType == 'protobuf') {
    return new Response(encodeExportResponse(signal, partial) as unknown as BodyInit, {
      status: 200,
      headers: { 'content-type': 'application/x-protobuf' }
    });
  }

  let body =
    partial && partial.rejected > 0
      ? {
          partialSuccess: {
            [rejectedFields[signal].json]: String(partial.rejected),
            ...(partial.message ? { errorMessage: partial.message } : {})
          }
        }
      : {};

  return Response.json(body, { status: 200 });
};
