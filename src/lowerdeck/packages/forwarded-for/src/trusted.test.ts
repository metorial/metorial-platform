import { describe, expect, it } from 'vitest';
import { extractTrustedClientIp } from './trusted';

let headers = (values: Record<string, string>) => new Headers(values);

describe('extractTrustedClientIp', () => {
  it('returns the visitor Cloudflare appended in front of its own edge address', () => {
    expect(
      extractTrustedClientIp(
        headers({
          'x-forwarded-for': '198.51.100.7, 173.245.48.10',
          'cf-connecting-ip': '198.51.100.7'
        })
      )
    ).toBe('198.51.100.7');
  });

  it('ignores addresses the client prepended to the chain', () => {
    expect(
      extractTrustedClientIp(
        headers({ 'x-forwarded-for': '198.51.100.7, 203.0.113.9, 162.158.1.1' })
      )
    ).toBe('203.0.113.9');
  });

  it('returns the same address whichever Cloudflare edge forwarded the request', () => {
    let first = extractTrustedClientIp(
      headers({ 'x-forwarded-for': '198.51.100.7, 173.245.48.10' })
    );
    let second = extractTrustedClientIp(
      headers({ 'x-forwarded-for': '198.51.100.7, 2a06:98c0:3600::103' })
    );

    expect(first).toBe('198.51.100.7');
    expect(second).toBe(first);
  });

  it('does not let a client egressing from Cloudflare ranges spoof an address', () => {
    expect(
      extractTrustedClientIp(
        headers({
          'x-forwarded-for': '198.51.100.7, 104.28.1.1, 162.158.4.4',
          'cf-connecting-ip': '104.28.1.1'
        })
      )
    ).toBe('104.28.1.1');
    expect(
      extractTrustedClientIp(
        headers({ 'x-forwarded-for': '198.51.100.7, 104.28.1.1, 162.158.4.4' })
      )
    ).toBe('104.28.1.1');
  });

  it('skips internal hops behind the Cloudflare edge', () => {
    expect(
      extractTrustedClientIp(
        headers({
          'x-forwarded-for': '203.0.113.5, 198.51.100.7, 173.245.48.10, 10.0.1.5',
          'cf-connecting-ip': '198.51.100.7'
        })
      )
    ).toBe('198.51.100.7');
  });

  it('ignores cf-connecting-ip unless the closest hop is Cloudflare', () => {
    expect(
      extractTrustedClientIp(
        headers({ 'x-forwarded-for': '203.0.113.9', 'cf-connecting-ip': '198.51.100.7' })
      )
    ).toBe('203.0.113.9');
    expect(
      extractTrustedClientIp(
        headers({ 'x-forwarded-for': '10.0.0.4', 'cf-connecting-ip': '198.51.100.7' })
      )
    ).toBe('10.0.0.4');
  });

  it('uses cf-connecting-ip when every hop is Cloudflare', () => {
    expect(
      extractTrustedClientIp(
        headers({
          'x-forwarded-for': '2a06:98c0:3600::103, 173.245.48.10',
          'cf-connecting-ip': '198.51.100.7'
        })
      )
    ).toBe('198.51.100.7');
  });

  it('returns the originating address of an internal request', () => {
    expect(extractTrustedClientIp(headers({ 'x-forwarded-for': '10.0.3.4, 10.0.1.1' }))).toBe(
      '10.0.3.4'
    );
  });

  it('normalizes addresses', () => {
    expect(extractTrustedClientIp(headers({ 'x-forwarded-for': '::ffff:198.51.100.7' }))).toBe(
      '198.51.100.7'
    );
    expect(extractTrustedClientIp(headers({ 'x-forwarded-for': '2001:DB8:0:0::1' }))).toBe(
      '2001:db8::1'
    );
  });

  it('returns nothing without a forwarded chain or past a malformed hop', () => {
    expect(extractTrustedClientIp(headers({ 'cf-connecting-ip': '198.51.100.7' }))).toBe(
      undefined
    );
    expect(extractTrustedClientIp(headers({ 'x-real-ip': '198.51.100.7' }))).toBe(undefined);
    expect(
      extractTrustedClientIp(headers({ 'x-forwarded-for': '198.51.100.7, unknown' }))
    ).toBe(undefined);
  });

  it('accepts a custom set of trusted proxies', () => {
    expect(
      extractTrustedClientIp(headers({ 'x-forwarded-for': '198.51.100.7, 203.0.113.9' }), {
        trustedProxyRanges: ['203.0.113.0/24']
      })
    ).toBe('198.51.100.7');
  });
});
