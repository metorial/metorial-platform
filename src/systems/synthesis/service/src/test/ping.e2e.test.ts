import { describe, expect, it } from 'vitest';
import { synthesisHttpApi } from '../http';

describe('synthesis ping', () => {
  it('returns OK from /ping', async () => {
    let response = await synthesisHttpApi.fetch(new Request('http://synthesis.test/ping'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
  });
});
