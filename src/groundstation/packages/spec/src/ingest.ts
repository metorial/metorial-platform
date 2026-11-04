export let ingestRouteKinds = ['otlp_http', 'otlp_grpc', 'hook', 'bulk'] as const;

export type IngestRouteKind = (typeof ingestRouteKinds)[number];

export let otlpSignals = ['logs', 'metrics', 'traces'] as const;

export type OtlpSignal = (typeof otlpSignals)[number];

export let ingestPayloadTypes = ['protobuf', 'json', 'ndjson'] as const;

export type IngestPayloadType = (typeof ingestPayloadTypes)[number];

export let ingestContentEncodings = ['identity', 'gzip', 'zstd'] as const;

export type IngestContentEncoding = (typeof ingestContentEncodings)[number];

export let ingestLimits = {
  maxBodyBytes: 4 * 1024 * 1024,
  maxBulkItems: 20_000
};
