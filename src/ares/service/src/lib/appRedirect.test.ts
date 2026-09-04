import { describe, expect, it } from 'vitest';
import { resolveAppRedirectUrl, wrapHorizonRedirectUrl } from './appRedirect';

let WRAPPER = 'https://horizon-sso.metorial.com/idp-callback';

let horizonApp = {
  mode: 'horizon' as const,
  defaultRedirectUrl: WRAPPER,
  redirectDomains: ['metorial.com', '*.metorial.com']
};

let standardApp = {
  mode: 'standard' as const,
  defaultRedirectUrl: 'https://app.metorial.com/callback',
  redirectDomains: ['metorial.com', '*.metorial.com']
};

describe('resolveAppRedirectUrl', () => {
  it('leaves a standard app untouched', () => {
    expect(
      resolveAppRedirectUrl({
        app: standardApp,
        redirectUrl: 'https://customer.metorial.com/test'
      })
    ).toBe('https://customer.metorial.com/test');
  });

  it('wraps a horizon redirect in the IdP-initiated endpoint', () => {
    let resolved = resolveAppRedirectUrl({
      app: horizonApp,
      redirectUrl: 'https://customer.metorial.com/test'
    });

    let url = new URL(resolved);
    expect(url.origin + url.pathname).toBe(WRAPPER);
    expect(url.searchParams.get('redirect_url')).toBe('https://customer.metorial.com/test');
  });

  it('does not wrap the wrapper itself', () => {
    expect(resolveAppRedirectUrl({ app: horizonApp, redirectUrl: WRAPPER })).toBe(WRAPPER);
  });

  it('does not wrap an already wrapped URL twice', () => {
    let once = resolveAppRedirectUrl({
      app: horizonApp,
      redirectUrl: 'https://customer.metorial.com/test'
    });

    expect(resolveAppRedirectUrl({ app: horizonApp, redirectUrl: once })).toBe(once);
  });

  it('leaves the legacy per-attempt callback alone', () => {
    let legacy =
      'https://horizon-sso.metorial.com/callback/aat_0mte3?clientSecret=metorial_hrzn_aat_sec_x';

    expect(resolveAppRedirectUrl({ app: horizonApp, redirectUrl: legacy })).toBe(legacy);
  });

  it('rejects a redirect outside the allowed domains before wrapping', () => {
    expect(() =>
      resolveAppRedirectUrl({ app: horizonApp, redirectUrl: 'https://evil.example/test' })
    ).toThrow();
  });

  it('refuses to wrap for a horizon app with no allowed domains', () => {
    expect(() =>
      resolveAppRedirectUrl({
        app: { ...horizonApp, redirectDomains: [] },
        redirectUrl: 'https://evil.example/test'
      })
    ).toThrow();
  });
});

describe('wrapHorizonRedirectUrl', () => {
  it('preserves query params already on the wrapper', () => {
    let resolved = wrapHorizonRedirectUrl({
      defaultRedirectUrl: `${WRAPPER}?source=horizon`,
      redirectUrl: 'https://customer.metorial.com/test'
    });

    let url = new URL(resolved);
    expect(url.searchParams.get('source')).toBe('horizon');
    expect(url.searchParams.get('redirect_url')).toBe('https://customer.metorial.com/test');
  });

  it('rejects an invalid redirect URL', () => {
    expect(() =>
      wrapHorizonRedirectUrl({ defaultRedirectUrl: WRAPPER, redirectUrl: 'not-a-url' })
    ).toThrow();
  });
});
