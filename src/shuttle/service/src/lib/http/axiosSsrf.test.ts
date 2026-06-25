import { describe, it, expect, beforeEach } from 'vitest';
import http from 'http';
import https from 'https';
import {
  useFreshModules,
  allowPrivateUrls,
  denyPrivateUrls,
  enableSsrfBypass,
  disableSsrfBypass
} from './ssrf.test-helpers';

let importModule = () => import('./axiosSsrf');

useFreshModules();

describe('checkIp', () => {
  beforeEach(disableSsrfBypass);

  describe('default (ssrf protection on)', () => {
    beforeEach(denyPrivateUrls);

    it('blocks private IPv4 addresses', async () => {
      let { checkIp } = await importModule();
      expect(checkIp('10.0.0.1')).toBe(false);
      expect(checkIp('192.168.1.1')).toBe(false);
      expect(checkIp('172.16.0.1')).toBe(false);
    });

    it('blocks loopback addresses', async () => {
      let { checkIp } = await importModule();
      expect(checkIp('127.0.0.1')).toBe(false);
      expect(checkIp('::1')).toBe(false);
    });

    it('allows public unicast addresses', async () => {
      let { checkIp } = await importModule();
      expect(checkIp('8.8.8.8')).toBe(true);
      expect(checkIp('1.1.1.1')).toBe(true);
      expect(checkIp('93.184.216.34')).toBe(true);
    });

    it('allows invalid IP strings (passthrough)', async () => {
      let { checkIp } = await importModule();
      expect(checkIp('not-an-ip')).toBe(true);
    });
  });

  describe('SHUTTLE_ALLOW_PRIVATE_URLS', () => {
    beforeEach(allowPrivateUrls);

    it('allows all IPs including private', async () => {
      let { checkIp } = await importModule();
      expect(checkIp('10.0.0.1')).toBe(true);
      expect(checkIp('192.168.1.1')).toBe(true);
      expect(checkIp('172.16.0.1')).toBe(true);
      expect(checkIp('127.0.0.1')).toBe(true);
      expect(checkIp('::1')).toBe(true);
    });

    it('still allows public IPs', async () => {
      let { checkIp } = await importModule();
      expect(checkIp('8.8.8.8')).toBe(true);
    });
  });
});

describe('ssrfFilter', () => {
  beforeEach(denyPrivateUrls);

  describe('default (ssrf protection on)', () => {
    beforeEach(disableSsrfBypass);

    it('patches createConnection on http agent', async () => {
      let { ssrfFilter } = await importModule();
      let agent = ssrfFilter(new URL('http://example.com'));

      expect(agent).toBeInstanceOf(http.Agent);
      expect((agent as any).createConnection).not.toBe(
        http.Agent.prototype.createConnection
      );
    });

    it('returns https agent for https URLs', async () => {
      let { ssrfFilter } = await importModule();
      let agent = ssrfFilter(new URL('https://example.com'));
      expect(agent).toBeInstanceOf(https.Agent);
    });
  });

  describe('SHUTTLE_UNSAFE_SSRF_BYPASS', () => {
    beforeEach(enableSsrfBypass);

    it('returns unpatched http agent', async () => {
      let { ssrfFilter } = await importModule();
      let agent = ssrfFilter(new URL('http://example.com'));

      expect(agent).toBeInstanceOf(http.Agent);
      expect((agent as any).createConnection).toBe(
        http.Agent.prototype.createConnection
      );
    });

    it('returns unpatched https agent', async () => {
      let { ssrfFilter } = await importModule();
      let agent = ssrfFilter(new URL('https://example.com'));

      expect(agent).toBeInstanceOf(https.Agent);
      expect((agent as any).createConnection).toBe(
        https.Agent.prototype.createConnection
      );
    });
  });
});

describe('getAxiosSsrfFilter', () => {
  beforeEach(denyPrivateUrls);
  beforeEach(disableSsrfBypass);

  it('returns both httpAgent and httpsAgent', async () => {
    let { getAxiosSsrfFilter } = await importModule();
    let result = getAxiosSsrfFilter('https://example.com');

    expect(result).toHaveProperty('httpAgent');
    expect(result).toHaveProperty('httpsAgent');
    expect(result.httpAgent).toBeInstanceOf(http.Agent);
    expect(result.httpsAgent).toBeInstanceOf(https.Agent);
  });
});
