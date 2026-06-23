import { apiMux } from '@lowerdeck/api-mux';
import { rpcMux } from '@lowerdeck/rpc-server';
import { RedisClient } from 'bun';
import { SynthesisRPC } from './controllers';
import { db } from './db';
import { env } from './env';
import { synthesisHttpApi } from './http';

let combinedApi = apiMux([
  {
    methods: ['GET', 'OPTIONS'],
    endpoint: {
      path: '/assistant-live',
      exact: false,
      fetch: synthesisHttpApi.fetch as any
    }
  },
  {
    methods: ['GET', 'OPTIONS'],
    endpoint: {
      path: '/ping',
      exact: true,
      fetch: synthesisHttpApi.fetch as any
    }
  },
  {
    endpoint: rpcMux({ path: '/metorial-synthesis' }, [SynthesisRPC])
  }
]);

let apiServer = Bun.serve({
  fetch: combinedApi,
  port: env.service.SYNTHESIS_API_PORT
});

console.log(`Synthesis API running on http://localhost:${apiServer.port}`);

let redis = new RedisClient(env.service.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: env.service.REDIS_URL?.startsWith('rediss://')
});

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
    port: env.service.SYNTHESIS_HEALTH_PORT
  });
}
