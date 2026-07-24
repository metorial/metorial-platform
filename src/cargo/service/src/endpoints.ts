import { apiMux } from '@lowerdeck/api-mux';
import { rpcMux } from '@lowerdeck/rpc-server';
import { env } from '@metorial-cargo/db';
import { documentLiveApi, websocket } from '@metorial-cargo/module-doc/live';
import { cargoContentApi, cargoUploadApi } from '@metorial-cargo/module-file/http';
import { RedisClient } from 'bun';
import { CargoRPC } from './controllers';
import { db } from './db';

let combinedApi = apiMux([
  {
    endpoint: {
      path: '/document-live',
      fetch: documentLiveApi.fetch as any
    }
  },

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
  port: env.service.CARGO_API_PORT,
  websocket,
  idleTimeout: 240
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
