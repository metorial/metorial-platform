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

export type IngestHandler = (request: IngestRequest) => Promise<Response>;
