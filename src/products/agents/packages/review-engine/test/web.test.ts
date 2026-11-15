import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWebAccess, type WebAccessEvent } from '../src/web';

let mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  fetch: vi.fn(),
  extract: vi.fn(),
  search: vi.fn()
}));

vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }));
vi.mock('@lowerdeck/ssrf', () => ({
  safeFetch: mocks.fetch,
  isPublicIp: (ip: string) => ip == '93.184.216.34'
}));
vi.mock('@metorial-services/scout-client', () => ({
  createScoutClient: () => ({ crawl: { extract: mocks.extract, search: mocks.search } })
}));

let events: WebAccessEvent[];

let web = (scout = true, apiKey: string | undefined = 'synthetic-key') =>
  createWebAccess({
    scout: scout ? { endpoint: 'https://scout.vendor.com', token: 'synthetic' } : undefined,
    webRiskApiKey: apiKey,
    onAccess: async event => {
      events.push(event);
    }
  });

beforeEach(() => {
  vi.clearAllMocks();
  events = [];
  mocks.lookup.mockResolvedValue([{ address: '93.184.216.34' }]);
  mocks.fetch.mockImplementation(async () => Response.json({}));
  mocks.extract.mockResolvedValue({
    markdown: 'Public documentation',
    url: 'https://docs.vendor.com/guide'
  });
  mocks.search.mockResolvedValue([{ title: 'Vendor', url: 'https://docs.vendor.com/guide' }]);
});

describe('guarded review web access', () => {
  it('screens locally before DNS, reputation checking or Firecrawl', async () => {
    await expect(web().fetch('https://docs.vendor.com/?token=short')).rejects.toThrow(
      'sensitive_url'
    );

    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.extract).not.toHaveBeenCalled();
    expect(events).toEqual([
      expect.objectContaining({
        domain: 'docs.vendor.com',
        dispatched: false,
        outcome: 'blocked',
        reason: 'sensitive_url'
      })
    ]);
    expect(JSON.stringify(events)).not.toContain('short');
  });

  it('blocks a public-looking name resolving to private addresses before checking reputation', async () => {
    mocks.lookup.mockResolvedValue([{ address: '10.0.0.1' }]);
    await expect(web().fetch('https://docs.vendor.com/guide')).rejects.toThrow(
      'private_destination'
    );

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it('checks a normalized URL before dispatching to Firecrawl and records domain-only metadata', async () => {
    let access = web();
    let result = await access.fetch('https://docs.vendor.com/guide#intro');

    expect(result).toEqual({
      url: 'https://docs.vendor.com/guide',
      markdown: 'Public documentation'
    });
    expect(mocks.fetch).toHaveBeenCalledOnce();
    let [endpoint, options] = mocks.fetch.mock.calls[0]!;
    expect(new URL(endpoint).searchParams.get('uri')).toBe('https://docs.vendor.com/guide');
    expect(endpoint).not.toContain('synthetic-key');
    expect(options.headers).toEqual({ 'X-Goog-Api-Key': 'synthetic-key' });
    expect(mocks.extract).toHaveBeenCalledWith(
      { url: 'https://docs.vendor.com/guide', securityReview: true },
      expect.objectContaining({
        retry: false,
        captureErrors: false,
        signal: expect.any(AbortSignal)
      })
    );
    expect(events[0]).toMatchObject({
      domain: 'docs.vendor.com',
      outcome: 'succeeded',
      dispatched: true,
      reputation: { verdict: 'no_known_threats' }
    });
    expect(JSON.stringify(events)).not.toContain('/guide');
  });

  it('blocks listed URLs and does not fall back to a direct request', async () => {
    mocks.fetch.mockResolvedValue(
      Response.json({
        threat: {
          threatTypes: ['MALWARE'],
          expireTime: new Date(Date.now() + 60_000).toISOString()
        }
      })
    );
    await expect(web().fetch('https://docs.vendor.com/guide')).rejects.toThrow('unsafe_url');

    expect(mocks.extract).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(events[0]).toMatchObject({ dispatched: false, reputation: { verdict: 'unsafe' } });
  });

  it('uses the requested URL when Scout does not return a final URL', async () => {
    mocks.extract.mockResolvedValue({ markdown: 'Public documentation' });

    await expect(web().fetch('https://docs.vendor.com/guide')).resolves.toEqual({
      url: 'https://docs.vendor.com/guide',
      markdown: 'Public documentation'
    });
  });

  it.each(['missing', 'failure', 'malformed'])(
    'stops fetches when reputation is %s',
    async mode => {
      if (mode == 'failure') mocks.fetch.mockRejectedValue(new Error('upstream URL secret'));
      if (mode == 'malformed')
        mocks.fetch.mockResolvedValue(Response.json({ error: 'invalid' }));
      let access =
        mode == 'missing'
          ? createWebAccess({
              onAccess: async event => {
                events.push(event);
              }
            })
          : web();

      await expect(access.fetch('https://docs.vendor.com/guide')).rejects.toThrow(
        'reputation_unavailable'
      );
      expect(mocks.extract).not.toHaveBeenCalled();
      expect(events[0]).toMatchObject({
        dispatched: false,
        outcome: 'blocked',
        reason: 'reputation_unavailable'
      });
    }
  );

  it('does not cache reputation by domain', async () => {
    let access = web();
    await access.fetch('https://docs.vendor.com/guide');
    await access.fetch('https://docs.vendor.com/guide');
    await access.fetch('https://docs.vendor.com/other');

    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it('sanitizes Firecrawl failures and never bypasses them using direct fetch', async () => {
    mocks.extract.mockRejectedValue(new Error('https://docs.vendor.com/?token=private'));

    await expect(web().fetch('https://docs.vendor.com/guide')).rejects.toThrow('fetch_failed');
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(events[0]).toMatchObject({ dispatched: true, reason: 'fetch_failed' });
  });

  it('rejects an unsafe final URL returned by Firecrawl', async () => {
    mocks.extract.mockResolvedValue({ markdown: 'page', url: 'http://docs.vendor.com/guide' });
    await expect(web().fetch('https://docs.vendor.com/guide')).rejects.toThrow(
      'https_required'
    );
    expect(events[0]).toMatchObject({ dispatched: true, outcome: 'blocked' });
  });

  it('checks direct-fetch redirects with the same policy', async () => {
    mocks.fetch.mockImplementation(async (url, options) => {
      if (String(url).includes('webrisk.googleapis.com')) return Response.json({});
      await options.assertUrl(new URL('https://docs.vendor.com/?token=short'));
      return new Response('unexpected');
    });

    await expect(web(false).fetch('https://docs.vendor.com/guide')).rejects.toThrow(
      'sensitive_url'
    );
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it('stops oversized direct response bodies while streaming', async () => {
    let canceled = vi.fn();
    mocks.fetch.mockImplementation(async url => {
      if (String(url).includes('webrisk.googleapis.com')) return Response.json({});
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(1024 * 1024 + 1));
          },
          cancel: canceled
        })
      );
    });

    await expect(web(false).fetch('https://docs.vendor.com/guide')).rejects.toThrow(
      'response_too_large'
    );
    expect(canceled).toHaveBeenCalled();
  });

  it('screens searches without logging their text or counting result domains as visits', async () => {
    let access = web();
    await expect(access.search('alice@customer.com')).rejects.toThrow('sensitive_query');
    expect(mocks.search).not.toHaveBeenCalled();

    await access.search('Vendor MCP documentation');
    expect(mocks.search).toHaveBeenCalledExactlyOnceWith(
      {
        query: 'Vendor MCP documentation',
        country: undefined,
        type: 'web',
        securityReview: true
      },
      expect.objectContaining({
        retry: false,
        captureErrors: false,
        signal: expect.any(AbortSignal)
      })
    );
    expect(events.map(event => event.domain)).toEqual([
      'api.firecrawl.dev',
      'api.firecrawl.dev'
    ]);
    expect(JSON.stringify(events)).not.toContain('alice');
    expect(JSON.stringify(events)).not.toContain('documentation');
  });

  it('does not dispatch when canceled', async () => {
    let signal = AbortSignal.abort();
    await expect(web().fetch('https://docs.vendor.com/guide', { signal })).rejects.toThrow();

    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it('stops waiting when DNS resolution is canceled', async () => {
    mocks.lookup.mockImplementation(() => new Promise(() => {}));
    let controller = new AbortController();
    let pending = web().fetch('https://docs.vendor.com/guide', { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toThrow('request_canceled');
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.extract).not.toHaveBeenCalled();
  });
});
