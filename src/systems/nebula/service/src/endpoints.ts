import { RedisClient } from 'bun';
import { nebulaApi } from './controllers';
import { db } from './db';
import { consumerService, keyProviderService } from './services';

await consumerService.ensureEnvConsumers();
await keyProviderService.ensureSystemDefaultProvider();

let server = Bun.serve({
  fetch: nebulaApi,
  port: 52060
});

console.log(`Service running on http://localhost:${server.port}`);

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
