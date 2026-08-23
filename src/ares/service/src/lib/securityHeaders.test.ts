import { afterEach, describe, expect, it } from 'vitest';
import { withSecurityHeaders } from './securityHeaders';

let originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('security headers', () => {
  it('preserves redirect responses while adding production headers for public hosts', async () => {
    process.env.NODE_ENV = 'production';
    let wrapped = withSecurityHeaders(async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'https://idp.example.test/authorize' }
      })
    );

    let response = await wrapped(
      new Request('https://sso.example.test/sso/auth'),
      undefined
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://idp.example.test/authorize');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('content-security-policy')).toContain(
      "script-src 'self' 'unsafe-inline'"
    );
    expect(response.headers.get('content-security-policy')).toContain(
      "img-src 'self' *.metorial-cdn.com metorial.com *.metorial.com"
    );
    expect(response.headers.get('content-security-policy')).toContain(
      '*.metorial-staging.com'
    );
  });

  it('does not add production headers for localhost', async () => {
    process.env.NODE_ENV = 'production';
    let wrapped = withSecurityHeaders(async () => new Response('ok'));

    let response = await wrapped(new Request('http://localhost:52122/sso/auth'), undefined);

    expect(response.headers.get('referrer-policy')).toBeNull();
  });
});
