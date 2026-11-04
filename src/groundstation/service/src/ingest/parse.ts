import {
  ingestLimits,
  type IngestContentEncoding,
  type IngestPayloadType
} from '@metorial/groundstation-spec';
import {
  payloadTooLargeError,
  unsupportedContentEncodingError,
  unsupportedMediaTypeError
} from './errors';
import type { IngestRequest } from './request';
import { errorResponse } from './response';
import type { IngestRouteDefinition } from './routes';

let payloadTypeByMediaType: Record<string, IngestPayloadType> = {
  'application/x-protobuf': 'protobuf',
  'application/protobuf': 'protobuf',
  'application/json': 'json',
  'application/x-ndjson': 'ndjson',
  'application/ndjson': 'ndjson'
};

let contentEncodingByHeader: Record<string, IngestContentEncoding> = {
  identity: 'identity',
  gzip: 'gzip',
  'x-gzip': 'gzip',
  zstd: 'zstd'
};

let extractCredential = (headers: Headers): string | undefined => {
  let authorization = headers.get('authorization')?.trim();
  let bearer = authorization ? /^Bearer\s+(.+)$/i.exec(authorization) : null;

  if (bearer) return bearer[1];

  return headers.get('x-api-key')?.trim() || undefined;
};

export let parseIngestRequest = (
  request: Request,
  definition: IngestRouteDefinition,
  params: Record<string, string>
): IngestRequest | Response => {
  let contentLength = Number(request.headers.get('content-length') ?? 0);

  if (contentLength > ingestLimits.maxBodyBytes) {
    return errorResponse(payloadTooLargeError());
  }

  let encodingHeader = request.headers.get('content-encoding')?.trim().toLowerCase();
  let contentEncoding = encodingHeader ? contentEncodingByHeader[encodingHeader] : 'identity';

  if (!contentEncoding) return errorResponse(unsupportedContentEncodingError());

  let payloadType: IngestPayloadType | undefined;

  if (definition.accepts.length > 0) {
    let mediaType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    payloadType = mediaType ? payloadTypeByMediaType[mediaType] : undefined;

    if (!payloadType || !definition.accepts.includes(payloadType)) {
      return errorResponse(unsupportedMediaTypeError());
    }
  }

  return {
    requestId: crypto.randomUUID(),
    routeKind: definition.routeKind,

    signal: definition.signal,
    client: params.client,

    payloadType,
    contentEncoding,
    credential: extractCredential(request.headers),

    body: request.body,
    raw: request
  };
};
