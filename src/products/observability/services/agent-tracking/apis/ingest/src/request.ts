import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';
import type {
  IngestContentEncoding,
  IngestPayloadType,
  IngestRouteKind,
  OtlpSignal
} from '@mtsrc/agent-tracking-spec';

export type IngestRequest = {
  requestId: string;
  routeKind?: Exclude<IngestRouteKind, 'otlp_grpc'>;

  signal?: OtlpSignal;
  client?: string;

  payloadType?: IngestPayloadType;
  contentEncoding: IngestContentEncoding;
  credential?: string;

  // Already decompressed and size-capped; reading it can fail with a ServiceError.
  body: ReadableStream<Uint8Array> | null;
  raw: Request;
  clientIp?: string;
};

export type AuthenticatedIngestRequest = IngestRequest & {
  principal: IngestPrincipal;
};

export type PublicIngestHandler = (request: IngestRequest) => Promise<Response>;

export type IngestHandler = (request: AuthenticatedIngestRequest) => Promise<Response>;

export let ingestCallOf = (request: AuthenticatedIngestRequest) => ({
  principal: request.principal,
  requestId: request.requestId,
  clientIp: request.clientIp
});
