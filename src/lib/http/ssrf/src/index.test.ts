import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertUrlIpAllowed, isPublicIp, safeFetch, SsrfBlockedError } from '.';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

let stubLookup = (addressFor: (hostname: string) => string) => {
  let lookup = vi
    .fn()
    .mockImplementation(async (hostname: string) => [
      { address: addressFor(hostname), family: 4, ttl: 60 }
    ]);
  vi.stubGlobal('Bun', { dns: { lookup } });
  return lookup;
};

let fetchCall = (fetchMock: ReturnType<typeof vi.fn>, index: number) => {
  let [url, init] = fetchMock.mock.calls[index]!;
  return { url, host: new Headers(init.headers).get('host'), tls: init.tls, init };
};

describe('safeFetch', () => {
  it('blocks private and internal addresses', () => {
    expect(isPublicIp('127.0.0.1')).toBe(false);
    expect(isPublicIp('10.0.0.1')).toBe(false);
    expect(isPublicIp('169.254.169.254')).toBe(false);
    expect(isPublicIp('::1')).toBe(false);
    expect(isPublicIp('93.184.216.34')).toBe(true);
  });

  it('checks DNS before making a request', async () => {
    stubLookup(() => '10.0.0.1');
    let fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    let error = await safeFetch('https://example.com').catch(error => error);
    expect(error).toBeInstanceOf(SsrfBlockedError);
    expect(error.message).toBe('Private or internal IP blocked');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks a private IP literal without a DNS lookup', async () => {
    let lookup = stubLookup(() => '93.184.216.34');
    let fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(safeFetch('http://[::1]:8080/hook')).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(lookup).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('connects to the validated address, keeping the Host header and TLS server name', async () => {
    let lookup = vi
      .fn()
      .mockResolvedValueOnce([
        { address: '2606:2800:220:1::1', family: 6, ttl: 60 },
        { address: '93.184.216.34', family: 4, ttl: 60 }
      ])
      .mockResolvedValue([{ address: '127.0.0.1', family: 4, ttl: 60 }]);
    vi.stubGlobal('Bun', { dns: { lookup } });
    let fetchMock = vi.fn().mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    let response = await safeFetch('https://example.com:8443/hook?a=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });

    expect(lookup).toHaveBeenCalledOnce();
    let call = fetchCall(fetchMock, 0);
    expect(call.url).toBe('https://93.184.216.34:8443/hook?a=1');
    expect(call.host).toBe('example.com:8443');
    expect(new Headers(call.init.headers).get('content-type')).toBe('application/json');
    expect(call.tls).toEqual({ serverName: 'example.com' });
    expect(call.init).toMatchObject({ method: 'POST', body: '{}', redirect: 'manual' });
    expect(response.url).toBe('https://example.com:8443/hook?a=1');
  });

  it('pins IPv6-only names and plain http without a TLS server name', async () => {
    vi.stubGlobal('Bun', {
      dns: {
        lookup: vi
          .fn()
          .mockResolvedValue([{ address: '2606:2800:220:1::1', family: 6, ttl: 60 }])
      }
    });
    let fetchMock = vi.fn().mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await safeFetch('http://example.com/hook');

    let call = fetchCall(fetchMock, 0);
    expect(call.url).toBe('http://[2606:2800:220:1::1]/hook');
    expect(call.host).toBe('example.com');
    expect(call.tls).toBeUndefined();
  });

  it('does not rewrite a public IP literal', async () => {
    let lookup = stubLookup(() => '10.0.0.1');
    let fetchMock = vi.fn().mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await safeFetch('https://93.184.216.34/hook');

    expect(lookup).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0]![0]).toBe('https://93.184.216.34/hook');
  });

  it('checks and pins every redirect target', async () => {
    stubLookup(hostname =>
      hostname == 'next.example.com' ? '93.184.216.35' : '93.184.216.34'
    );
    let fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://next.example.com/final' }
        })
      )
      .mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    let response = await safeFetch('http://example.com/start');

    expect(fetchCall(fetchMock, 0)).toMatchObject({
      url: 'http://93.184.216.34/start',
      host: 'example.com'
    });
    expect(fetchCall(fetchMock, 1)).toMatchObject({
      url: 'https://93.184.216.35/final',
      host: 'next.example.com',
      tls: { serverName: 'next.example.com' }
    });
    expect(response.url).toBe('https://next.example.com/final');
  });

  it('drops credential headers when a redirect changes origin', async () => {
    stubLookup(() => '93.184.216.34');
    let fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 307,
          headers: { location: 'https://other.example.com/next' }
        })
      )
      .mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await safeFetch('https://example.com/start', {
      headers: {
        Authorization: 'Bearer secret',
        Cookie: 'session=1',
        'Proxy-Authorization': 'Basic abc',
        'X-Api-Key': 'key',
        Accept: 'image/*'
      },
      crossOriginRedirectStripHeaders: ['x-api-key']
    });

    let first = new Headers(fetchCall(fetchMock, 0).init.headers);
    expect(first.get('authorization')).toBe('Bearer secret');
    expect(first.get('x-api-key')).toBe('key');

    let second = new Headers(fetchCall(fetchMock, 1).init.headers);
    expect(second.get('authorization')).toBeNull();
    expect(second.get('cookie')).toBeNull();
    expect(second.get('proxy-authorization')).toBeNull();
    expect(second.get('x-api-key')).toBeNull();
    expect(second.get('accept')).toBe('image/*');
    expect(second.get('host')).toBe('other.example.com');
  });

  it('keeps credential headers on a same-origin redirect', async () => {
    stubLookup(() => '93.184.216.34');
    let fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: '/next' } })
      )
      .mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await safeFetch('https://example.com/start', {
      headers: { Authorization: 'Bearer secret' }
    });

    expect(new Headers(fetchCall(fetchMock, 1).init.headers).get('authorization')).toBe(
      'Bearer secret'
    );
  });

  it('treats a scheme change as a different origin', async () => {
    stubLookup(() => '93.184.216.34');
    let fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: 'http://example.com/next' } })
      )
      .mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await safeFetch('https://example.com/start', {
      headers: { Authorization: 'Bearer secret' }
    });

    expect(new Headers(fetchCall(fetchMock, 1).init.headers).get('authorization')).toBeNull();
  });

  it('switches to GET without a body on 303, and on 301/302 after a POST', async () => {
    stubLookup(() => '93.184.216.34');

    for (let [status, method, expected] of [
      [303, 'PUT', 'GET'],
      [302, 'POST', 'GET'],
      [301, 'POST', 'GET'],
      [302, 'PUT', 'PUT']
    ] as const) {
      let fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status, headers: { location: '/next' } }))
        .mockResolvedValueOnce(new Response('ok'));
      vi.stubGlobal('fetch', fetchMock);

      await safeFetch('https://example.com/start', {
        method,
        headers: { 'content-type': 'application/json' },
        body: '{}'
      });

      let second = fetchCall(fetchMock, 1).init;
      expect(second.method).toBe(expected);

      if (expected == 'GET') {
        expect(second.body).toBeUndefined();
        expect(new Headers(second.headers).get('content-type')).toBeNull();
      } else {
        expect(second.body).toBe('{}');
        expect(new Headers(second.headers).get('content-type')).toBe('application/json');
      }
    }
  });

  it('keeps the method and body on 307 and 308', async () => {
    stubLookup(() => '93.184.216.34');

    for (let status of [307, 308]) {
      let fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status, headers: { location: '/next' } }))
        .mockResolvedValueOnce(new Response('ok'));
      vi.stubGlobal('fetch', fetchMock);

      await safeFetch('https://example.com/start', { method: 'POST', body: '{}' });

      expect(fetchCall(fetchMock, 1).init).toMatchObject({ method: 'POST', body: '{}' });
    }
  });

  it('blocks a redirect to an internal address', async () => {
    stubLookup(hostname =>
      hostname == 'internal.example.com' ? '127.0.0.1' : '93.184.216.34'
    );
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

  it('fetches the URL as given when the IP check is disabled', async () => {
    let lookup = stubLookup(() => '127.0.0.1');
    let fetchMock = vi.fn().mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await safeFetch('http://localhost:8080/hook', { isIpAllowed: false });

    expect(lookup).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0]![0]).toBe('http://localhost:8080/hook');
  });
});

describe('assertUrlIpAllowed', () => {
  it('rejects names that resolve to internal addresses and private IP literals', async () => {
    stubLookup(() => '169.254.169.254');

    await expect(assertUrlIpAllowed('https://example.com')).rejects.toBeInstanceOf(
      SsrfBlockedError
    );
    await expect(assertUrlIpAllowed('http://10.0.0.1/')).rejects.toBeInstanceOf(
      SsrfBlockedError
    );
  });

  it('accepts public addresses and rejects unsupported schemes', async () => {
    stubLookup(() => '93.184.216.34');

    await expect(assertUrlIpAllowed('https://example.com')).resolves.toBeUndefined();
    await expect(assertUrlIpAllowed('file:///etc/passwd')).rejects.toThrow(
      'Unsupported protocol'
    );
  });
});
