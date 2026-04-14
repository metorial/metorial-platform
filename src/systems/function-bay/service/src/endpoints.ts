import { RedisClient } from 'bun';
import { functionBayApi } from './controllers';
import { db } from './db';

let server = Bun.serve({
  fetch: functionBayApi,
  port: 52030
});

console.log(`Service running on http://localhost:${server.port}`);

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

Bun.serve({
  fetch: async _ => {
    try {
      await db.tenant.count();

      await redis.ping();

      return new Response('OK');
    } catch (e) {
      return new Response('Service Unavailable', { status: 503 });
    }
  },
  port: 12121
});
