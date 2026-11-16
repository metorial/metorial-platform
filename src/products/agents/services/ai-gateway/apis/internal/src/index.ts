import { apiMux } from '@lowerdeck/api-mux';
import { aiGatewayRpcApi } from './controllers';
import { aiGatewayHttpApi } from './http';

export { AiGatewayRPC, type AiGatewayClient } from './controllers';

export let aiGatewayApi = apiMux(
  [
    {
      methods: ['GET', 'OPTIONS'],
      endpoint: { path: '/assistant-live', exact: false, fetch: aiGatewayHttpApi.fetch as any }
    },
    {
      methods: ['GET', 'OPTIONS'],
      endpoint: { path: '/ping', exact: true, fetch: aiGatewayHttpApi.fetch as any }
    }
  ],
  aiGatewayRpcApi
);
