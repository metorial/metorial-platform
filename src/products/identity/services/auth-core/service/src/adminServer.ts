import { adminApi } from '@mtsrc/auth-core-api-admin';
import { withSecurityHeaders } from '@mtsrc/auth-core-http';
import { aresPorts } from '@mtsrc/auth-core-runtime';

let adminServer = Bun.serve({
  fetch: withSecurityHeaders(adminApi),
  port: aresPorts.admin
});

console.log(`Admin service running on http://localhost:${adminServer.port}`);
