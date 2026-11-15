import { describe, expect, it } from 'vitest';
import { checkIp, ssrfFilter, getAxiosSsrfFilter } from '../ssrf';

describe('checkIp', () => {
  it.concurrent.each([
    '8.8.8.8',
    '1.1.1.1',
    '2001:4860:4860::8888',
    '2606:4700:4700::1111'
  ])(
    'allows public address %s',
    ip => {
      expect(checkIp(ip)).toBe(true);
    }
  );

  it.concurrent.each([
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '127.0.0.1',
    '::1',
    '169.254.1.1',
    'fe80::1',
    '224.0.0.1',
    'ff02::1',
    '255.255.255.255',
    'fc00::1',
    '0.0.0.0',
    '::'
  ])('blocks private/reserved address %s', ip => {
    expect(checkIp(ip)).toBe(false);
  });

  it.concurrent.each(['not-an-ip', 'example.com', '300.300.300.300', ''])(
    'passes through invalid input %s',
    value => {
      expect(checkIp(value)).toBe(true);
    }
  );
});

describe('ssrfFilter', () => {
  it.concurrent.each(['http://example.com', 'https://example.com'])(
    'creates an agent for %s',
    url => {
      const agent = ssrfFilter(new URL(url));
      expect(agent).toBeDefined();
      expect(typeof agent).toBe('object');
    }
  );
});

describe('getAxiosSsrfFilter', () => {
  it.concurrent.each(['http://example.com', 'https://example.com'])(
    'returns axios agents for %s',
    url => {
      const config = getAxiosSsrfFilter(url);
      expect(config).toHaveProperty('httpAgent');
      expect(config).toHaveProperty('httpsAgent');
      expect(config.httpAgent).toBeDefined();
      expect(config.httpsAgent).toBeDefined();
    }
  );
});
