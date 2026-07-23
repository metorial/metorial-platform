import { RedisClient } from 'bun';
import { VoyagerApi } from './controllers';
import { db } from './db';

let server = Bun.serve({
  fetch: VoyagerApi,
  port: Number(process.env.VOYAGER_PORT ?? '52060')
});

console.log(`Service running on http://localhost:${server.port}`);

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

if (process.env.NODE_ENV === 'production') {
  Bun.serve({
    fetch: async _ => {
      try {
        await db.backend.count();

        await redis.ping();

        return new Response('OK');
      } catch (e) {
        return new Response('Service Unavailable', { status: 503 });
      }
    },
    port: 12121
  });
}
