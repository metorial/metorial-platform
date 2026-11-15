import { beforeAll } from 'vitest';

beforeAll(async () => {
  await import('@mtsrc/agent-tracking-module-attribution/src/listeners');
  await import('../src/listeners');
});
