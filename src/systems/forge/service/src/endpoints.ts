import { RedisClient } from 'bun';
import { forgeApi } from './controllers';
import { db } from './db';

let serveApi: typeof forgeApi = (request, server) => {
  let url = new URL(request.url);
  if (url.pathname === '/ping') return new Response('OK');
  return forgeApi(request, server);
};

let server = Bun.serve({
  fetch: serveApi,
  port: 52020
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
