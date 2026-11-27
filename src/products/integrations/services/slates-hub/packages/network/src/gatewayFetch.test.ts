import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  proxy: vi.fn((subject: unknown, lifetime: string) => ({
    url: 'http://egress-gateway:8080',
    headers: { 'Proxy-Authorization': `Bearer grant-${lifetime}` }
  }))
}));

vi.mock('./egressGateway', () => ({
  getEgressGateway: () => ({ proxy: mocks.proxy })
}));

let { EgressGatewayRefusedError, gatewayFetch } = await import('./gatewayFetch');

let subject = { tenantId: 'fbtn_1', enclaveId: 'enc_1', policy: { entries: [] } };

let fetchMock = vi.fn();

let tunnelError = (status: string) =>
  Object.assign(new Error(`Proxy refused: ${status}`), { code: 'ERR_PROXY_TUNNEL' });

describe('gatewayFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the request through the gateway with a grant for the subject', async () => {
    fetchMock.mockResolvedValueOnce(new Response('file'));

    let response = await gatewayFetch('https://files.example/a.png', {
      subject,
      headers: { authorization: 'Bearer upstream' },
      maxRedirects: 3,
      lifetime: 'stream'
    });

    expect(await response.text()).toBe('file');
    expect(mocks.proxy).toHaveBeenCalledWith(subject, 'stream');
    expect(fetchMock).toHaveBeenCalledWith(new URL('https://files.example/a.png'), {
      headers: { authorization: 'Bearer upstream' },
      redirect: 'manual',
      proxy: {
        url: 'http://egress-gateway:8080',
        headers: { 'Proxy-Authorization': 'Bearer grant-stream' }
      }
    });
  });

  it('sends every redirect hop through the gateway and strips cross-origin headers', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/b' } }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://other.example/c' }
        })
      )
      .mockResolvedValueOnce(new Response('moved'));

    let headers = { 'x-upstream-auth': 'value' };
    let response = await gatewayFetch('https://files.example/a', {
      subject,
      headers,
      maxRedirects: 3,
      lifetime: 'stream'
    });

    expect(await response.text()).toBe('moved');
    expect(fetchMock.mock.calls.map(call => String(call[0]))).toEqual([
      'https://files.example/a',
      'https://files.example/b',
      'https://other.example/c'
    ]);
    expect(fetchMock.mock.calls.every(call => call[1].proxy)).toBe(true);
    expect(fetchMock.mock.calls.map(call => call[1].headers)).toEqual([
      headers,
      headers,
      undefined
    ]);
  });

  it('stops after the redirect limit', async () => {
    fetchMock.mockImplementation(
      async () => new Response(null, { status: 302, headers: { location: '/loop' } })
    );

    await expect(
      gatewayFetch('https://files.example/a', { subject, maxRedirects: 2, lifetime: 'stream' })
    ).rejects.toThrow('Too many redirects');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejects redirects to other protocols', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'file:///etc/passwd' } })
    );

    await expect(
      gatewayFetch('https://files.example/a', { subject, maxRedirects: 2, lifetime: 'stream' })
    ).rejects.toThrow('Unsupported protocol');
  });

  it('maps gateway refusals of plain http requests', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 403, headers: { 'x-metorial-egress-error': 'denied' } })
    );

    let error = await gatewayFetch('http://files.example/a', {
      subject,
      maxRedirects: 0,
      lifetime: 'stream'
    }).catch(err => err);

    expect(error).toBeInstanceOf(EgressGatewayRefusedError);
    expect(error.refusal).toBe('denied');
  });

  it('maps refused tunnels', async () => {
    fetchMock.mockRejectedValueOnce(tunnelError('407 Proxy Authentication Required'));

    let error = await gatewayFetch('https://files.example/a', {
      subject,
      maxRedirects: 0,
      lifetime: 'stream'
    }).catch(err => err);

    expect(error).toBeInstanceOf(EgressGatewayRefusedError);
    expect(error.refusal).toBe('unauthorized');
  });

  it('passes other upstream failures through', async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'));

    await expect(
      gatewayFetch('https://files.example/a', { subject, maxRedirects: 0, lifetime: 'stream' })
    ).rejects.toThrow('socket hang up');
  });
});
