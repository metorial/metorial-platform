import type { IngestPrincipal } from '../auth/principal';
import type {
  IngestContentEncoding,
  IngestPayloadType,
  IngestRouteKind,
  OtlpSignal
} from '@metorial/groundstation-spec';

export type IngestRequest = {
  requestId: string;
  routeKind?: Exclude<IngestRouteKind, 'otlp_grpc'>;

  signal?: OtlpSignal;
  client?: string;

  payloadType?: IngestPayloadType;
  contentEncoding: IngestContentEncoding;
  credential?: string;

  body: ReadableStream<Uint8Array> | null;
  raw: Request;
};

export type AuthenticatedIngestRequest = IngestRequest & {
  principal: IngestPrincipal;
};

export type PublicIngestHandler = (request: IngestRequest) => Promise<Response>;

export type IngestHandler = (request: AuthenticatedIngestRequest) => Promise<Response>;
