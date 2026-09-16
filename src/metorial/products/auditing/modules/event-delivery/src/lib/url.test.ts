import { describe, expect, it } from 'vitest';
import { assertDeliveryUrlAllowed, DeliveryUrlNotAllowedError } from './url';

let expectBlocked = (url: string) =>
  expect(() => assertDeliveryUrlAllowed(url)).toThrow(DeliveryUrlNotAllowedError);

describe('assertDeliveryUrlAllowed', () => {
  it('allows a public https URL', () => {
    expect(assertDeliveryUrlAllowed('https://example.com/webhooks').hostname).toBe(
      'example.com'
    );
  });

  it('allows a public IP literal', () => {
    expect(() => assertDeliveryUrlAllowed('https://93.184.216.34/hook')).not.toThrow();
  });

  it('rejects anything that is not http(s)', () => {
    expectBlocked('file:///etc/passwd');
    expectBlocked('gopher://example.com');
    expectBlocked('ftp://example.com');
  });

  it('rejects credentials embedded in the URL', () => {
    expectBlocked('https://user:pass@example.com/hook');
  });

  it('rejects loopback addresses', () => {
    expectBlocked('http://127.0.0.1/hook');
    expectBlocked('http://[::1]/hook');
  });

  it('rejects private ranges', () => {
    expectBlocked('http://10.0.0.5/hook');
    expectBlocked('http://192.168.1.10/hook');
    expectBlocked('http://172.16.0.1/hook');
  });

  it('rejects the cloud metadata address', () => {
    expectBlocked('http://169.254.169.254/latest/meta-data/');
  });

  it('rejects IPv4-mapped IPv6 loopback', () => {
    expectBlocked('http://[::ffff:127.0.0.1]/hook');
  });

  it('rejects a malformed URL', () => {
    expectBlocked('not a url');
  });
});
