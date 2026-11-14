import { adminApi } from './apis/admin';
import { withSecurityHeaders } from './lib/securityHeaders';
import { aresPorts } from './ports';

let adminServer = Bun.serve({
  fetch: withSecurityHeaders(adminApi),
  port: aresPorts.admin
});

console.log(`Admin service running on http://localhost:${adminServer.port}`);
