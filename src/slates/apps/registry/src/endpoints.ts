import { RedisClient } from 'bun';
import { adminApi } from './apis/admin';
import { slatesRegistryApi } from './apis/internal';
import { registryApp } from './apis/public';
import { db } from './db';

Bun.serve({
  fetch: registryApp.fetch,
  port: 52040
});

Bun.serve({
  fetch: slatesRegistryApi,
  port: 52041
});

Bun.serve({
  fetch: adminApi,
  port: 52042
});

console.log('Slates registry server is running');

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

if (process.env.NODE_ENV === 'production') {
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
}
