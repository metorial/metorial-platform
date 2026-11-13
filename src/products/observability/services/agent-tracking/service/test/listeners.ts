import { beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../src/listeners');
});
