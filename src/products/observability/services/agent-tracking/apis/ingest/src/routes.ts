import type { IngestChannel, IngestPayloadType, OtlpSignal } from '@mtsrc/agent-tracking-spec';
import { bulkDialectsHandler, bulkIngestHandler } from './handlers/bulk';
import { pingHandler } from './handlers/health';
import { hookHandler } from './handlers/hooks';
import { otlpHandler } from './handlers/otlp';
import type { IngestHandler, IngestRequest, PublicIngestHandler } from './request';

type IngestRouteBase = {
  method: 'GET' | 'POST';
  path: string;

  routeKind?: IngestRequest['routeKind'];
  signal?: OtlpSignal;
  channel?: IngestChannel;

  accepts: IngestPayloadType[];
};

export type IngestRouteDefinition = IngestRouteBase &
  ({ auth: 'none'; handler: PublicIngestHandler } | { auth: 'token'; handler: IngestHandler });

export let ingestRoutes: IngestRouteDefinition[] = [
  { method: 'GET', path: '/ping', auth: 'none', accepts: [], handler: pingHandler },

  {
    method: 'POST',
    path: '/v1/logs',
    routeKind: 'otlp_http',
    signal: 'logs',
    channel: 'otlp.logs',
    auth: 'token',
    accepts: ['protobuf', 'json'],
    handler: otlpHandler
  },

  {
    method: 'POST',
    path: '/v1/metrics',
    routeKind: 'otlp_http',
    signal: 'metrics',
    channel: 'otlp.metrics',
    auth: 'token',
    accepts: ['protobuf', 'json'],
    handler: otlpHandler
  },

  {
    method: 'POST',
    path: '/v1/traces',
    routeKind: 'otlp_http',
    signal: 'traces',
    channel: 'otlp.traces',
    auth: 'token',
    accepts: ['protobuf', 'json'],
    handler: otlpHandler
  },

  {
    method: 'POST',
    path: '/v1/otlp',
    routeKind: 'otlp_http',
    auth: 'token',
    accepts: ['protobuf', 'json'],
    handler: otlpHandler
  },

  {
    method: 'POST',
    path: '/v1/ingest/hooks/:client',
    routeKind: 'hook',
    channel: 'hook',
    auth: 'token',
    accepts: ['json'],
    handler: hookHandler
  },

  {
    method: 'POST',
    path: '/v1/bulk',
    routeKind: 'bulk',
    auth: 'token',
    accepts: ['ndjson'],
    handler: bulkIngestHandler
  },

  {
    method: 'GET',
    path: '/v1/bulk/dialects',
    auth: 'none',
    accepts: [],
    handler: bulkDialectsHandler
  }
];
