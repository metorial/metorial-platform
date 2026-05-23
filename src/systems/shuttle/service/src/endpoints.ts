import { apiMux } from '@mtsrc/api-mux';
import { rpcMux } from '@mtsrc/rpc-server';
import { withTracingSuppressed } from '@mtsrc/telemetry';
import { RedisClient } from 'bun';
import { connectionApp, websocket } from './apis/connection';
import { ShuttleRPC } from './apis/controllers';
import { publicApp } from './apis/public';
import { db } from './db';

let shuttleApi = apiMux(
  [{ endpoint: rpcMux({ path: '/metorial-shuttle' }, [ShuttleRPC]) }],
  connectionApp.fetch as any
);

let apiServer = Bun.serve({
  fetch: shuttleApi,
  port: 52080,
  websocket,
  idleTimeout: 240
});

let publicServer = Bun.serve({
  fetch: publicApp.fetch,
  port: 52081,
  websocket
});

console.log(`Service running on http://localhost:${apiServer.port}`);
console.log(`Public service running on http://localhost:${publicServer.port}`);

let checkDatabase = async () => {
  await db.server.count();
};

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

let checkRedis = async () => {
  await redis.ping();
};

// let HOLOPOD_READY_GRACE_MS = 2 * 60 * 1000;
// let lastHolopodHealthyAt = 0;
// let checkHolopod = async () => {
//   try {
//     await checkHolopodHealth({ timeoutMs: 3000 });
//     lastHolopodHealthyAt = Date.now();
//   } catch (err) {
//     // Keep readiness green for short transient outages after a recent successful check.
//     if (
//       lastHolopodHealthyAt > 0 &&
//       Date.now() - lastHolopodHealthyAt <= HOLOPOD_READY_GRACE_MS
//     ) {
//       console.warn('Holopod health check transient failure within grace window', err);
//       return;
//     }

//     throw err;
//   }
// };

if (process.env.NODE_ENV === 'production') {
  Bun.serve({
    fetch: async req =>
      withTracingSuppressed(async () => {
        let step = 'initializing';
        let path = new URL(req.url).pathname;

        try {
          step = 'checking database';
          await checkDatabase();

          step = 'checking redis';
          await checkRedis();

          // step = 'checking holopod';
          // await checkHolopodHealth();

          return new Response('OK');
        } catch (e) {
          console.error(`Health check failed at step: ${step}`, e);
          return new Response('Service Unavailable', { status: 503 });
        }
      }),
    port: 12121
  });
}
