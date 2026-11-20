import { startHealthServer } from '@metorial/doctor';
import { RedisClient } from 'bun';
import { RelayApi } from './controllers';
import { db } from './db';
import { emailDoctorChecks } from './doctor';
import { env } from './env';

let server = Bun.serve({
  fetch: RelayApi,
  port: env.service.RELAY_PORT ?? 52110
});

console.log(`Service running on http://localhost:${server.port}`);

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

let started = Date.now();

startHealthServer({
  component: 'email',
  checks: emailDoctorChecks(redis),
  liveness: async () => {
    try {
      if (Date.now() - started > 60_000) {
        await db.emailIdentity.count();
        await redis.ping();
      }

      return new Response('OK');
    } catch (e) {
      console.error('Health check failed', e);
      return new Response('Service Unavailable', { status: 503 });
    }
  }
});
