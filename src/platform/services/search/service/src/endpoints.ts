import { startHealthServer } from '@metorial/doctor';
import { RedisClient } from 'bun';
import { VoyagerApi } from './controllers';
import { db } from './db';
import { searchDoctorChecks } from './doctor';
import { env } from './env';

let server = Bun.serve({
  fetch: VoyagerApi,
  port: env.service.VOYAGER_PORT ?? 52060
});

console.log(`Service running on http://localhost:${server.port}`);

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

startHealthServer({
  component: 'search',
  checks: searchDoctorChecks(redis),
  liveness: async () => {
    try {
      await db.backend.count();

      await redis.ping();

      return new Response('OK');
    } catch (e) {
      return new Response('Service Unavailable', { status: 503 });
    }
  }
});
