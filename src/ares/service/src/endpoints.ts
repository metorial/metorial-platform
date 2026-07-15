import { getSentry } from '@lowerdeck/sentry';
import { RedisClient } from 'bun';
import { adminApi } from './apis/admin';
import { authApi } from './apis/auth';
import { internalApi } from './apis/internal';
import { ssoApi } from './apis/sso';
import { db } from './db';
import { withSecurityHeaders } from './lib/securityHeaders';
import { aresPorts } from './ports';

let Sentry = getSentry();

let authServer = Bun.serve({
  fetch: withSecurityHeaders(authApi),
  port: aresPorts.auth
});

let adminServer = Bun.serve({
  fetch: withSecurityHeaders(adminApi),
  port: aresPorts.admin
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

if (process.env.NODE_ENV === 'production') {
  let startTime = Date.now();
  let hour = 60 * 60 * 1000;
  let maxUptime = hour * 4 + Math.random() * hour * 2;

  Bun.serve({
    fetch: async _ => {
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
    },
    port: aresPorts.health
  });
}

console.log(`Auth service running on http://localhost:${authServer.port}`);
console.log(`Admin service running on http://localhost:${adminServer.port}`);
console.log(`SSO service running on http://localhost:${ssoServer.port}`);
console.log(`Internal service running on http://localhost:${internalServer.port}`);
