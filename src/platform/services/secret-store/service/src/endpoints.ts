import { startHealthServer } from '@metorial/doctor';
import { RedisClient } from 'bun';
import { nebulaApi } from './controllers';
import { db } from './db';
import { secretStoreDoctorChecks } from './doctor';
import { env } from './env';
import { consumerService, keyProviderService, secretPurposeService } from './services';

await consumerService.ensureEnvConsumers();
await keyProviderService.ensureSystemDefaultProvider();
await secretPurposeService.warmKnownPurposes();

let server = Bun.serve({
  fetch: nebulaApi,
  port: env.service.NEBULA_API_PORT ?? 52170
});

console.log(`Service running on http://localhost:${server.port}`);

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

startHealthServer({
  component: 'secret-store',
  checks: secretStoreDoctorChecks(redis),
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
