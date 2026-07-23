import { api } from './api';
import { websocket } from './api/metorialIntegrationProtocol';

Bun.serve({
  fetch: api.fetch,
  websocket,
  port: 52072,
  idleTimeout: 0
});
