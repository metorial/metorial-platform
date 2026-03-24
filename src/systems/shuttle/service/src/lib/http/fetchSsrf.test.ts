import { describe, it, expect, beforeEach } from 'vitest';
import {
  useFreshModules,
  allowPrivateUrls,
  denyPrivateUrls,
  enableSsrfBypass,
  disableSsrfBypass,
  mockFetch,
  mockBunDns
} from './ssrf.test-helpers';

let importModule = () => import('./fetchSsrf');

useFreshModules();

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
