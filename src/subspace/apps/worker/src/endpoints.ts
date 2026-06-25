import { withTracingSuppressed } from '@lowerdeck/telemetry';
import { db } from '@metorial-subspace/db';
import { getConnectionReceiver } from '@metorial-subspace/module-connection';
import { checkNatsHealth } from '@metorial-subspace/module-connection/src/health';
import { RedisClient } from 'bun';

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

if (process.env.NODE_ENV === 'production') {
  let startTime = Date.now();
  let hour = 60 * 60 * 1000;
  let maxUptime = hour * 10 + Math.random() * hour * 10; // 10-16 hours

  Bun.serve({
    fetch: async _ =>
      await withTracingSuppressed(async () => {
        let uptime = Date.now() - startTime;
        if (uptime > maxUptime) {
          return new Response('Service Unavailable', { status: 503 });
        }

        try {
          await db.backend.count();

          await redis.ping();

          await checkNatsHealth();

          let receiver = getConnectionReceiver();
          if (receiver && receiver.isReady() && !receiver.isHealthy()) {
            console.error('Connection receiver is unhealthy');
            return new Response('Service Unavailable', { status: 503 });
          }

          return new Response('OK');
        } catch (e) {
          console.error('Health check failed:', e);
          return new Response('Service Unavailable', { status: 503 });
        }
      }),
    port: 12121
  });
}
