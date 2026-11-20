import { startHealthServer } from '@metorial/doctor';
import { withTracingSuppressed } from '@lowerdeck/telemetry';
import { RedisClient } from 'bun';
import { slatesHubApi } from './apis/internal';
import { hubApp } from './apis/public';
import { liveInvocationOnlyApp } from './apis/public/liveInvocation';
import { db } from './db';
import { slatesHubDoctorChecks } from './doctor';
import { env } from './env';

let LIVE_MAX_REQUEST_BODY_BYTES = 4 * 1024 * 1024;

Bun.serve({
  fetch: hubApp.fetch,
  port: env.service.SLATES_HUB_PUBLIC_PORT ?? 52045,
  idleTimeout: 250
});

Bun.serve({
  fetch: slatesHubApi,
  port: env.service.SLATES_HUB_INTERNAL_PORT ?? 52046,
  idleTimeout: 250
});

// Runtimes that run untrusted slate code reach the hub only on this listener.
if (env.service.SLATES_HUB_LIVE_PORT) {
  Bun.serve({
    fetch: liveInvocationOnlyApp.fetch,
    port: env.service.SLATES_HUB_LIVE_PORT,
    idleTimeout: 60,
    maxRequestBodySize: LIVE_MAX_REQUEST_BODY_BYTES
  });
}

console.log('Slates hub server is running');

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

startHealthServer({
  component: 'integration-controller',
  checks: slatesHubDoctorChecks(redis),
  liveness: async _ =>
    withTracingSuppressed(async () => {
      try {
        await db.hub.count();

        await redis.ping();

        return new Response('OK');
      } catch (e) {
        return new Response('Service Unavailable', { status: 503 });
      }
    })
});
