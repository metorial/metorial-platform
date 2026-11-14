import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchBuildManifest } from './fetchBuildManifest';

let mockFetch = (impl: () => Promise<Response>) => {
  vi.stubGlobal('fetch', vi.fn(impl));
};

describe('fetchBuildManifest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the parsed manifest', async () => {
    mockFetch(async () => new Response(JSON.stringify({ hash: 'abc' }), { status: 200 }));

    let result = await fetchBuildManifest('https://example.test/manifest.json');

    expect(result).toEqual({ success: true, value: { hash: 'abc' } });
  });

  it('fails without throwing when the response is HTML', async () => {
    mockFetch(
      async () =>
        new Response('<html>error</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' }
        })
    );

    let result = await fetchBuildManifest('https://example.test/manifest.json');

    expect(result.success).toBe(false);
  });

  it('fails when the status is not ok', async () => {
    mockFetch(async () => new Response('<html>bad gateway</html>', { status: 502 }));

    let result = await fetchBuildManifest('https://example.test/manifest.json');

    expect(result).toEqual({ success: false, reason: 'unexpected status 502' });
  });

  it('fails when the request throws', async () => {
    mockFetch(async () => {
      throw new Error('network down');
    });

    let result = await fetchBuildManifest('https://example.test/manifest.json');

    expect(result.success).toBe(false);
  });
});
