import { withTracingSuppressed } from '@lowerdeck/telemetry';
import { ingestLimits } from '@mtsrc/agent-tracking-spec';
import { RedisClient } from 'bun';
import { AgentTrackingApi } from '@mtsrc/agent-tracking-api-internal';
import { db } from '@mtsrc/agent-tracking-db';
import { env } from './env';
import { ingestFetch } from '@mtsrc/agent-tracking-api-ingest';

let rpcServer = Bun.serve({
  fetch: AgentTrackingApi,
  port: env.service.AGENT_TRACKING_API_PORT ?? 52180
});

console.log(`RPC running on http://localhost:${rpcServer.port}`);

let ingestServer = Bun.serve({
  fetch: ingestFetch,
  port: env.service.AGENT_TRACKING_INGEST_PORT ?? 52181,
  maxRequestBodySize: ingestLimits.maxBodyBytes
});

console.log(`Ingest running on http://localhost:${ingestServer.port}`);

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

if (process.env.NODE_ENV === 'production') {
  Bun.serve({
    fetch: async _ =>
      withTracingSuppressed(async () => {
        try {
          await db.organization.count();

          await redis.ping();

          return new Response('OK');
        } catch (e) {
          console.log(e);
          return new Response('Service Unavailable', { status: 503 });
        }
      }),
    port: 12151
  });
}
