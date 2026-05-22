import { describe, expect, it } from 'vitest';
import { app } from '../api/public';

describe('subspace-public ping', () => {
  it('returns OK from /ping', async () => {
    let response = await app.fetch(new Request('http://subspace-public.test/ping'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
  });
});
