import { adminApi } from './apis/admin';
import { env } from './env';

Bun.serve({
  fetch: adminApi,
  port: env.ports.SLATES_REGISTRY_ADMIN_PORT ?? 52042
});
