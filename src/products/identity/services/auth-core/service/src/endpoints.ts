import { startHealthServer } from '@metorial/doctor';
import { getSentry } from '@lowerdeck/sentry';
import { RedisClient } from 'bun';
import { authApi } from '@mtsrc/auth-core-api-auth';
import { internalApi } from '@mtsrc/auth-core-api-internal';
import { ssoApi } from '@mtsrc/auth-core-api-sso';
import { db } from '@mtsrc/auth-core-db';
import { withSecurityHeaders } from '@mtsrc/auth-core-http';
import { aresPorts } from '@mtsrc/auth-core-runtime';
import { authCoreDoctorChecks } from './doctor';

let Sentry = getSentry();

let authServer = Bun.serve({
  fetch: withSecurityHeaders(authApi),
  port: aresPorts.auth
});

let ssoServer = Bun.serve({
  fetch: withSecurityHeaders(ssoApi),
  port: aresPorts.sso
});

let internalServer = Bun.serve({
  fetch: internalApi,
  port: aresPorts.internal
});

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

let startTime = Date.now();
let hour = 60 * 60 * 1000;
let maxUptime = hour * 4 + Math.random() * hour * 2;

startHealthServer({
  component: 'auth-core',
  checks: authCoreDoctorChecks(redis),
  ports: [aresPorts.health],
  liveness: async () => {
    let uptime = Date.now() - startTime;
    if (uptime > maxUptime) {
      return new Response('Service Unavailable', { status: 503 });
    }

    try {
      await db.app.count();

      await redis.ping();

      return new Response('OK');
    } catch (e) {
      Sentry.captureException(e);
      return new Response('Service Unavailable', { status: 503 });
    }
  }
});

console.log(`Auth service running on http://localhost:${authServer.port}`);
console.log(`SSO service running on http://localhost:${ssoServer.port}`);
console.log(`Internal service running on http://localhost:${internalServer.port}`);
