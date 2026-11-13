import { beforeAll } from 'vitest';

beforeAll(async () => {
  await import('@mtsrc/agent-tracking-module-ingest-access/src/listeners');
});
