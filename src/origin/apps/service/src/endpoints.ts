import { withTracingSuppressed } from '@lowerdeck/telemetry';
import { RedisClient } from 'bun';
import { originApi } from './controllers';
import { db } from './db';
import { scmController } from './public/scm';
import { scmBackendService } from './services';

await scmBackendService.ensureDefaultBackends();

let originServer = Bun.serve({
  fetch: originApi,
  port: 52090,
  idleTimeout: 250
});

let scmServer = Bun.serve({
  fetch: scmController.fetch,
  port: 52093,
  idleTimeout: 60
});

console.log(`Origin controller running on http://localhost:${originServer.port}`);
console.log(`SCM controller running on http://localhost:${scmServer.port}`);

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
          return new Response('Service Unavailable', { status: 503 });
        }
      }),
    port: 12121
  });
}
