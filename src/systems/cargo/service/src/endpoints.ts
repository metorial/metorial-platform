import { apiMux } from '@lowerdeck/api-mux';
import { rpcMux } from '@lowerdeck/rpc-server';
import { RedisClient } from 'bun';
import { CargoRPC } from './controllers';
import { db } from './db';
import { env } from './env';
import { cargoContentApi, cargoUploadApi } from './http';

let combinedApi = apiMux([
  {
    methods: ['POST', 'OPTIONS'],
    endpoint: {
      path: '/files',
      exact: true,
      fetch: cargoUploadApi.fetch as any
    }
  },

  {
    endpoint: rpcMux({ path: '/metorial-cargo' }, [CargoRPC])
  }
]);

let apiServer = Bun.serve({
  fetch: combinedApi,
  port: env.service.CARGO_API_PORT
});

let contentServer = Bun.serve({
  fetch: cargoContentApi.fetch,
  port: env.service.CARGO_CONTENT_PORT
});

let redis = new RedisClient(env.service.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: env.service.REDIS_URL?.startsWith('rediss://')
});

console.log(`Cargo API running on http://localhost:${apiServer.port}`);
console.log(`Cargo content running on http://localhost:${contentServer.port}`);

if (process.env.NODE_ENV === 'production') {
  Bun.serve({
    fetch: async _ => {
      try {
        await db.tenant.count();
        await redis.ping();
        return new Response('OK');
      } catch (error) {
        console.error(error);
        return new Response('Service Unavailable', { status: 503 });
      }
    },
    port: env.service.CARGO_HEALTH_PORT
  });
}
