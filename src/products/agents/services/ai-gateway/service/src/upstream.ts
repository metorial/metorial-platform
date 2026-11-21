import { routeProviderTrafficThrough } from '@mtsrc/ai-gateway-providers';
import { env } from './env';

routeProviderTrafficThrough(env.service.AI_GATEWAY_UPSTREAM_PROXY_URL ?? null);
