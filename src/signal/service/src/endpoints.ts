import { withTracingSuppressed } from '@lowerdeck/telemetry';
import { RedisClient } from 'bun';
import { SignalApi } from './controllers';
import { db } from './db';

let server = Bun.serve({
  fetch: SignalApi,
  port: Number(process.env.SIGNAL_API_PORT ?? '52050')
});

console.log(`Service running on http://localhost:${server.port}`);

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

if (process.env.NODE_ENV === 'production') {
  Bun.serve({
    fetch: async _ =>
      withTracingSuppressed(async () => {
        try {
          await db.tenant.count();

          await redis.ping();

          return new Response('OK');
        } catch (e) {
          console.log(e);
          return new Response('Service Unavailable', { status: 503 });
        }
      }),
    port: 12121
  });
}
