import { createDoctor } from '@lowerdeck/doctor';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mtsrc/auth-core-db', () => ({ db: {} }));
vi.mock('./env', () => ({ env: { service: {}, sso: {}, keys: {} } }));

let { publicUrlsCheck, samlAudienceCheck, ssoCertificateCheck, twoFactorKeyCheck } =
  await import('./doctor');

let run = async (checks: Parameters<typeof createDoctor>[0]['checks']) =>
  (await createDoctor({ component: 'auth-core', checks }).run()).checks[0]!;

let day = 24 * 60 * 60 * 1000;

describe('auth-core doctor', () => {
  it('fails when the sign-in URLs leave the public URL', async () => {
    let result = await run([
      publicUrlsCheck(
        { authUrl: 'https://metorial.example.com/auth', ssoUrl: 'https://other.example.com' },
        'https://metorial.example.com'
      )
    ]);

    expect(result.status).toBe('fail');
    expect(result.message).toContain('ARES_SSO_URL');
  });

  it('passes when they match, and skips without a public URL', async () => {
    let settings = { authUrl: 'https://a.example.com/x', ssoUrl: 'https://a.example.com/y' };

    expect((await run([publicUrlsCheck(settings, 'https://a.example.com')])).status).toBe(
      'pass'
    );
    expect((await run([publicUrlsCheck(settings, undefined)])).status).toBe('skip');
  });

  it('warns about a drifted SAML audience', async () => {
    expect(
      (await run([samlAudienceCheck('https://old.example.com', 'https://a.example.com')]))
        .status
    ).toBe('warn');
    expect(
      (await run([samlAudienceCheck('https://a.example.com', 'https://a.example.com')])).status
    ).toBe('pass');
  });

  it('requires the two-factor key only when setup is enabled', async () => {
    expect((await run([twoFactorKeyCheck(undefined, undefined)])).status).toBe('skip');
    expect((await run([twoFactorKeyCheck('true', undefined)])).status).toBe('fail');
    expect((await run([twoFactorKeyCheck('true', 'key')])).status).toBe('pass');
  });

  it('reports expired and expiring SSO certificates', async () => {
    let at = (offset: number) => new Date(Date.now() + offset);

    expect((await run([ssoCertificateCheck(async () => [])])).status).toBe('skip');
    expect(
      (await run([ssoCertificateCheck(async () => [{ name: 'a', validTo: at(-day) }])])).status
    ).toBe('fail');
    expect(
      (await run([ssoCertificateCheck(async () => [{ name: 'a', validTo: at(5 * day) }])]))
        .status
    ).toBe('warn');
    expect(
      (await run([ssoCertificateCheck(async () => [{ name: 'a', validTo: at(90 * day) }])]))
        .status
    ).toBe('pass');
  });
});
