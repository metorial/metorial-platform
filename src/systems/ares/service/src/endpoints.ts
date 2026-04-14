import { RedisClient } from 'bun';
import { adminApi } from './apis/admin';
import { authApi } from './apis/auth';
import { internalApi } from './apis/internal';
import { ssoApi } from './apis/sso';
import { db } from './db';
import { withSecurityHeaders } from './lib/securityHeaders';

let authServer = Bun.serve({
  fetch: withSecurityHeaders(authApi),
  port: 52120
});

let adminServer = Bun.serve({
  fetch: withSecurityHeaders(adminApi),
  port: 52121
});

let ssoServer = Bun.serve({
  fetch: ssoApi,
  port: 52122
});

let internalServer = Bun.serve({
  fetch: internalApi,
  port: 52123
});

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

Bun.serve({
  fetch: async _ => {
    try {
      await db.admin.count();

      await redis.ping();

      return new Response('OK');
    } catch (e) {
      console.error('Health check failed', e);
      return new Response('Service Unavailable', { status: 503 });
    }
  },
  port: 12121
});

console.log(`Auth service running on http://localhost:${authServer.port}`);
console.log(`Admin service running on http://localhost:${adminServer.port}`);
console.log(`SSO service running on http://localhost:${ssoServer.port}`);
console.log(`Internal service running on http://localhost:${internalServer.port}`);
