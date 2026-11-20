import { withTracingSuppressed } from '@lowerdeck/telemetry';
import { inferenceFetch } from '@mtsrc/ai-gateway-api-inference';
import { aiGatewayApi } from '@mtsrc/ai-gateway-api-internal';
import { db } from '@mtsrc/ai-gateway-db';
import { billingService } from '@mtsrc/ai-gateway-module-billing';
import { inferenceLogService } from '@mtsrc/ai-gateway-module-logs';
import { RedisClient } from 'bun';
import { env } from './env';

let apiServer = Bun.serve({
  fetch: aiGatewayApi,
  port: env.service.AI_GATEWAY_API_PORT
});

console.log(`AI Gateway API running on http://localhost:${apiServer.port}`);

let inferenceServer = Bun.serve({
  fetch: inferenceFetch,
  port: env.service.AI_GATEWAY_INFERENCE_PORT,
  maxRequestBodySize: 32 * 1024 * 1024,
  idleTimeout: 255
});

console.log(`AI Gateway inference running on http://localhost:${inferenceServer.port}`);

let redis = new RedisClient(env.service.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: env.service.REDIS_URL?.startsWith('rediss://')
});

if (process.env.NODE_ENV === 'production') {
  Bun.serve({
    fetch: async _ =>
      withTracingSuppressed(async () => {
        try {
          await db.organization.count();
          await redis.ping();

          return new Response('OK');
        } catch (error) {
          console.error(error);
          return new Response('Service Unavailable', { status: 503 });
        }
      }),
    port: env.service.AI_GATEWAY_HEALTH_PORT
  });
}

let shutdown = async () => {
  await inferenceServer.stop();
  await Promise.all([inferenceLogService.close(), billingService.close()]);
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
