import type { IngestPayloadType, OtlpSignal } from '@metorial/groundstation-spec';
import { bulkDialectsHandler, bulkIngestHandler } from './handlers/bulk';
import { pingHandler } from './handlers/health';
import { hookHandler } from './handlers/hooks';
import { otlpHandler } from './handlers/otlp';
import type { IngestHandler, IngestRequest } from './request';

export type IngestRouteDefinition = {
  method: 'GET' | 'POST';
  path: string;

  routeKind?: IngestRequest['routeKind'];
  signal?: OtlpSignal;

  accepts: IngestPayloadType[];
  handler: IngestHandler;
};

export let ingestRoutes: IngestRouteDefinition[] = [
  { method: 'GET', path: '/ping', accepts: [], handler: pingHandler },

  {
    method: 'POST',
    path: '/v1/logs',
    routeKind: 'otlp_http',
    signal: 'logs',
    accepts: ['protobuf', 'json'],
    handler: otlpHandler
  },

  {
    method: 'POST',
    path: '/v1/metrics',
    routeKind: 'otlp_http',
    signal: 'metrics',
    accepts: ['protobuf', 'json'],
    handler: otlpHandler
  },

  {
    method: 'POST',
    path: '/v1/traces',
    routeKind: 'otlp_http',
    signal: 'traces',
    accepts: ['protobuf', 'json'],
    handler: otlpHandler
  },

  {
    method: 'POST',
    path: '/v1/otlp',
    routeKind: 'otlp_http',
    accepts: ['protobuf', 'json'],
    handler: otlpHandler
  },

  {
    method: 'POST',
    path: '/v1/ingest/hooks/:client',
    routeKind: 'hook',
    accepts: ['json'],
    handler: hookHandler
  },

  {
    method: 'POST',
    path: '/v1/bulk',
    routeKind: 'bulk',
    accepts: ['ndjson'],
    handler: bulkIngestHandler
  },

  { method: 'GET', path: '/v1/bulk/dialects', accepts: [], handler: bulkDialectsHandler }
];
