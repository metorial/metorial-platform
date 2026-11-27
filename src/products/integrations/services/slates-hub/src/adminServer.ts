import { adminApi } from './apis/admin';
import { env } from './env';

Bun.serve({
  fetch: adminApi,
  port: env.service.SLATES_HUB_ADMIN_PORT ?? 52047
});
