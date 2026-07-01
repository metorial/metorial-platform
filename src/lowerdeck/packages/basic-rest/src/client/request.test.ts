import { describe, expect, it, vi } from 'vitest';
import { request } from './request';

describe('request', () => {
  it('builds a fetch request from entity payloads', async () => {
    let fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await request({
      endpoint: 'https://example.com',
      path: ['test', 'get'],
      payload: { input: { term: 'abc' } },
      headers: { authorization: 'Bearer token' }
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    let [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain('https://example.com/test?term=abc');
    expect(init?.method).toBe('GET');
    expect((init?.headers as Record<string, string>)['authorization']).toBe('Bearer token');

    fetchSpy.mockRestore();
  });
});
