import { withTracingSuppressed } from '@mtsrc/telemetry';
import { RedisClient } from 'bun';
import { adminApi } from './apis/admin';
import { slatesHubApi } from './apis/internal';
import { hubApp } from './apis/public';
import { db } from './db';

Bun.serve({
  fetch: hubApp.fetch,
  port: 52045
});

Bun.serve({
  fetch: slatesHubApi,
  port: 52046
});

Bun.serve({
  fetch: adminApi,
  port: 52047
});

console.log('Slates hub server is running');

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

if (process.env.NODE_ENV === 'production') {
  Bun.serve({
    fetch: async _ =>
      withTracingSuppressed(async () => {
        try {
          await db.hub.count();

          await redis.ping();

          return new Response('OK');
        } catch (e) {
          return new Response('Service Unavailable', { status: 503 });
        }
      }),
    port: 12121
  });
}
