import { describe, expect, it } from 'vitest';
import { workerHealthFetch } from '../health';

describe('subspace-worker health', () => {
  it('returns OK when database and redis are reachable', async () => {
    let response = await workerHealthFetch(new Request('http://worker.test/'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
  });
});
