import { startHealthServer } from '@metorial/doctor';
import { RedisClient } from 'bun';
import { slatesRegistryApi } from './apis/internal';
import { registryApp } from './apis/public';
import { db } from './db';
import { slatesRegistryDoctorChecks } from './doctor';
import { env } from './env';

Bun.serve({
  fetch: registryApp.fetch,
  port: env.ports.SLATES_REGISTRY_PUBLIC_PORT ?? 52040
});

Bun.serve({
  fetch: slatesRegistryApi,
  port: env.ports.SLATES_REGISTRY_INTERNAL_PORT ?? 52041
});

console.log('Slates registry server is running');

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

startHealthServer({
  component: 'integration-registry',
  checks: slatesRegistryDoctorChecks(redis),
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
