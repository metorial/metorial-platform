import { withTracingSuppressed } from '@lowerdeck/telemetry';
import { RedisClient } from 'bun';
import { adminApi } from './apis/admin';
import { slatesHubApi } from './apis/internal';
import { hubApp } from './apis/public';
import { db } from './db';
import { env } from './env';
import { validateWebhookCaptureConformanceReport } from './lib/webhookRequestCapture';

let securedWebhookIngressEnabled = validateWebhookCaptureConformanceReport(
  process.env.SLATES_WEBHOOK_CAPTURE_CONFORMANCE_REPORT_JSON,
  process.env.SLATES_DEPLOYMENT_ID,
  {
    buildId: process.env.SLATES_BUILD_ID,
    route: 'slates_hub_public_native_v1',
    configDigest: process.env.SLATES_EDGE_CONFIG_DIGEST,
    serviceAuthSecret: env.slates.SLATES_HUB_SECRET_RPC_TOKEN
  }
);
console.log('Secured webhook ingress conformance gate:', {
  enabled: securedWebhookIngressEnabled,
  deploymentIdPresent: Boolean(process.env.SLATES_DEPLOYMENT_ID)
});
Bun.serve({
  fetch: hubApp.fetch,
  port: 52045,
  idleTimeout: 250
});

Bun.serve({
  fetch: slatesHubApi,
  port: 52046,
  idleTimeout: 250
});

Bun.serve({
  fetch: adminApi,
  port: 52047
});

console.log('Slates hub server is running');

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

if (process.env.NODE_ENV === 'production') {
  Bun.serve({
    fetch: async _ =>
      withTracingSuppressed(async () => {
        try {
          await db.hub.count();

          await redis.ping();

          return new Response('OK');
        } catch (e) {
          return new Response('Service Unavailable', { status: 503 });
        }
      }),
    port: 12121
  });
}
