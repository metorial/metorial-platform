import { getSentry } from '@mtsrc/sentry';
import { api } from './api';
import { websocket } from './api/metorialIntegrationProtocol';

let Sentry = getSentry();

Bun.serve({
  fetch: api.fetch,
  websocket,
  port: 52072,
  idleTimeout: 0
});
