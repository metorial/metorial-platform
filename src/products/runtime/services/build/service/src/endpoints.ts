import { startHealthServer } from '@metorial/doctor';
import { RedisClient } from 'bun';
import { forgeApi } from './controllers';
import { db } from './db';
import { buildDoctorChecks } from './doctor';
import { env } from './env';

let server = Bun.serve({
  fetch: forgeApi,
  port: env.service.FORGE_API_PORT ?? 52020
});

console.log(`Service running on http://localhost:${server.port}`);

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

startHealthServer({
  component: 'build',
  checks: buildDoctorChecks(redis),
  liveness: async () => {
    try {
      await db.tenant.count();

      await redis.ping();

      return new Response('OK');
    } catch (e) {
      return new Response('Service Unavailable', { status: 503 });
    }
  }
});
