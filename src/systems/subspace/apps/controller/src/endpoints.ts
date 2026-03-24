import { withTracingSuppressed } from '@lowerdeck/telemetry';
import { db } from '@metorial-subspace/db';
import { RedisClient } from 'bun';
import { subspaceControllerApi } from './controllers';

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

let server = Bun.serve({
  fetch: subspaceControllerApi,
  port: 52070
});

console.log(`Service running on http://localhost:${server.port}`);

if (process.env.NODE_ENV === 'production') {
  Bun.serve({
    fetch: async _ =>
      await withTracingSuppressed(async () => {
        try {
          await db.backend.count();

          await redis.ping();

          return new Response('OK');
        } catch (e) {
          return new Response('Service Unavailable', { status: 503 });
        }
      }),
    port: 12121
  });
}
