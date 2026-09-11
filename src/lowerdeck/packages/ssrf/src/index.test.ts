import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPublicIp, safeFetch } from '.';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('safeFetch', () => {
  it('blocks private and internal addresses', () => {
    expect(isPublicIp('127.0.0.1')).toBe(false);
    expect(isPublicIp('10.0.0.1')).toBe(false);
    expect(isPublicIp('169.254.169.254')).toBe(false);
    expect(isPublicIp('::1')).toBe(false);
    expect(isPublicIp('93.184.216.34')).toBe(true);
  });

  it('checks DNS before making a request', async () => {
    let lookup = vi.fn().mockResolvedValue([{ address: '10.0.0.1', family: 4, ttl: 60 }]);
    vi.stubGlobal('Bun', { dns: { lookup } });
    let fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(safeFetch('https://example.com')).rejects.toThrow(
      'Private or internal IP blocked'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks every redirect target', async () => {
    let lookup = vi.fn().mockImplementation(async (hostname: string) => [
      {
        address: hostname == 'internal.example.com' ? '127.0.0.1' : '93.184.216.34',
        family: 4,
        ttl: 60
      }
    ]);
    vi.stubGlobal('Bun', { dns: { lookup } });
    let fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'https://internal.example.com/secret' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(safeFetch('https://example.com')).rejects.toThrow(
      'Private or internal IP blocked'
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
