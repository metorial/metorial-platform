import { ingestLimits } from '@mtsrc/agent-tracking-spec';
import { ingestFetch } from '@mtsrc/agent-tracking-api-ingest';
import { env } from './env';

let ingestServer = Bun.serve({
  fetch: ingestFetch,
  port: env.listeners.ingestPort,
  maxRequestBodySize: ingestLimits.maxBodyBytes
});

console.log(`Ingest running on http://localhost:${ingestServer.port}`);
