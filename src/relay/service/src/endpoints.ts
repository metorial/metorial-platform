import { RedisClient } from 'bun';
import { RelayApi } from './controllers';
import { db } from './db';

let server = Bun.serve({
  fetch: RelayApi,
  port: 52110
});

console.log(`Service running on http://localhost:${server.port}`);

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

Bun.serve({
  fetch: async _ => {
    try {
      await db.emailIdentity.count();

      await redis.ping();

      return new Response('OK');
    } catch (e) {
      console.error('Health check failed', e);
      return new Response('Service Unavailable', { status: 503 });
    }
  },
  port: 12121
});
