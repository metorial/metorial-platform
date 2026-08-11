import { api } from './api';
import { websocket } from './api/metorialIntegrationProtocol';

let server = Bun.serve({
  fetch: api.fetch,
  websocket,
  port: 52072,
  idleTimeout: 0
});

console.log(`Connection service running on http://localhost:${server.port}`);
