import { describe, expect, it } from 'vitest';
import { pingApp } from '../api/public/pingApp';

describe('subspace-public ping', () => {
  it('returns OK from /ping', async () => {
    let response = await pingApp.fetch(new Request('http://subspace-public.test/ping'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
  });
});
