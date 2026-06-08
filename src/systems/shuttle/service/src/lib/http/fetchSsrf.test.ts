import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  allowPrivateUrls,
  denyPrivateUrls,
  disableSsrfBypass,
  enableSsrfBypass,
  mockBunDns,
  mockFetch,
  useFreshModules
} from './ssrf.test-helpers';

let importModule = () => import('./fetchSsrf');

let setNodeDnsMock = (addresses: Record<string, string[]> | string[]) => {
  vi.doMock('node:dns/promises', () => ({
    lookup: vi.fn().mockImplementation((hostname: string) => {
      let resolvedAddresses = Array.isArray(addresses)
        ? addresses
        : (addresses[hostname] ?? []);

      return Promise.resolve(resolvedAddresses.map(address => ({ address })));
    })
  }));
};

let mockNodeDns = (addresses: Record<string, string[]> | string[]) => {
  beforeEach(() => setNodeDnsMock(addresses));

  afterEach(() => {
    vi.doUnmock('node:dns/promises');
  });
};

useFreshModules();

afterEach(() => {
  vi.doUnmock('node:dns/promises');
});

describe('safeFetch', () => {
  describe('SHUTTLE_UNSAFE_SSRF_BYPASS', () => {
    beforeEach(enableSsrfBypass);
    beforeEach(denyPrivateUrls);
    let f = mockFetch();

    it('bypasses all checks and calls fetch directly', async () => {
      let { safeFetch } = await importModule();
      await safeFetch('http://10.0.0.1/api');

      expect(f.mock).toHaveBeenCalledOnce();
      expect(f.mock).toHaveBeenCalledWith('http://10.0.0.1/api', {});
    });

    it('passes options through unchanged', async () => {
      let { safeFetch } = await importModule();
      let headers = { Authorization: 'Bearer token' };
      await safeFetch('http://192.168.1.1/api', { method: 'POST', headers });

      expect(f.mock).toHaveBeenCalledWith('http://192.168.1.1/api', {
        method: 'POST',
        headers
      });
    });

    it('does not set redirect to manual', async () => {
      let { safeFetch } = await importModule();
      await safeFetch('http://example.com');

      expect(f.mock.mock.calls[0]?.[1]).not.toHaveProperty('redirect');
    });
  });

  describe('SHUTTLE_ALLOW_PRIVATE_URLS (without ssrf bypass)', () => {
    beforeEach(allowPrivateUrls);
    beforeEach(disableSsrfBypass);
    let f = mockFetch();
    mockBunDns(['10.0.0.1']);

    it('allows requests to private IPs', async () => {
      let { safeFetch } = await importModule();
      await safeFetch('http://example.com');

      expect(f.mock).toHaveBeenCalledOnce();
    });

    it('still uses redirect: manual', async () => {
      let { safeFetch } = await importModule();
      await safeFetch('http://example.com');

      expect(f.mock).toHaveBeenCalledWith(
        'http://example.com/',
        expect.objectContaining({ redirect: 'manual' })
      );
    });
  });

  describe('default (ssrf protection on)', () => {
    beforeEach(denyPrivateUrls);
    beforeEach(disableSsrfBypass);
    let f = mockFetch();

    describe('with public DNS', () => {
      mockBunDns(['93.184.216.34']);

      it('sets redirect to manual for SSRF protection', async () => {
        let { safeFetch } = await importModule();
        await safeFetch('http://example.com');

        expect(f.mock).toHaveBeenCalledWith(
          'http://example.com/',
          expect.objectContaining({ redirect: 'manual' })
        );
      });

      describe('with egress policy', () => {
        mockNodeDns(['93.184.216.34']);

        let egressPolicy = {
          direction: 'egress' as const,
          entries: [{ cidr: '93.184.216.0/24', portRange: { from: 80, to: 80 } }]
        };

        it('allows requests when the resolved address and port match the policy', async () => {
          let { safeFetch } = await importModule();
          await safeFetch('http://example.com', { egressPolicy });

          expect(f.mock).toHaveBeenCalledWith(
            'http://example.com/',
            expect.objectContaining({ redirect: 'manual' })
          );
        });

        it('does not pass internal options through to fetch', async () => {
          let { safeFetch } = await importModule();
          await safeFetch('http://example.com', { egressPolicy, maxRedirects: 3 });

          expect(f.mock.mock.calls[0]?.[1]).not.toHaveProperty('egressPolicy');
          expect(f.mock.mock.calls[0]?.[1]).not.toHaveProperty('maxRedirects');
        });
      });
    });

    describe('with private DNS', () => {
      mockBunDns(['10.0.0.1']);

      it('blocks requests that resolve to private IPs', async () => {
        let { safeFetch } = await importModule();
        await expect(safeFetch('http://example.com')).rejects.toThrow(
          'Private or internal IP blocked'
        );
        expect(f.mock).not.toHaveBeenCalled();
      });
    });

    describe('with egress policy', () => {
      mockBunDns(['93.184.216.34']);

      it('blocks requests outside the egress policy', async () => {
        setNodeDnsMock(['93.184.216.34']);

        let { safeFetch } = await importModule();
        await expect(
          safeFetch('http://example.com', {
            egressPolicy: {
              direction: 'egress',
              entries: [{ cidr: '192.0.2.0/24' }]
            }
          })
        ).rejects.toMatchObject({
          data: {
            code: 'egress_policy_blocked',
            message:
              'Metorial Magic Network: Remote URL is not allowed by the connection egress policy'
          }
        });

        expect(f.mock).not.toHaveBeenCalled();
      });

      it('blocks redirect targets outside the egress policy', async () => {
        setNodeDnsMock({
          'example.com': ['93.184.216.34'],
          'redirect.example.com': ['192.0.2.10']
        });

        f.mock
          .mockResolvedValueOnce(
            new Response('', {
              status: 302,
              headers: { location: 'http://redirect.example.com/' }
            })
          )
          .mockResolvedValueOnce(new Response('ok'));

        let { safeFetch } = await importModule();
        await expect(
          safeFetch('http://example.com', {
            egressPolicy: {
              direction: 'egress',
              entries: [{ cidr: '93.184.216.0/24', portRange: { from: 80, to: 80 } }]
            }
          })
        ).rejects.toMatchObject({
          data: {
            code: 'egress_policy_blocked',
            message:
              'Metorial Magic Network: Remote URL is not allowed by the connection egress policy'
          }
        });

        expect(f.mock).toHaveBeenCalledOnce();
      });
    });

    it('rejects non-http protocols', async () => {
      let { safeFetch } = await importModule();
      await expect(safeFetch('ftp://example.com')).rejects.toThrow('Unsupported protocol');
    });

    it('rejects URLs with credentials', async () => {
      let { safeFetch } = await importModule();
      await expect(safeFetch('http://user:pass@example.com')).rejects.toThrow(
        'Credentials in URL are not allowed'
      );
    });
  });
});
