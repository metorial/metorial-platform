import { describe, expect, it } from 'vitest';
import { ssoSqlConnection } from './ssoSqlConnection';

let base = 'postgres://metorial:secret@db.example.com:5432/metorial_ares_sso';

describe('ssoSqlConnection', () => {
  it('encrypts without verifying for no-verify, which Bun rejects in the URL', () => {
    expect(ssoSqlConnection(`${base}?sslmode=no-verify`)).toEqual({
      url: base,
      tls: { rejectUnauthorized: false }
    });
  });

  it('verifies the certificate for the other modes', () => {
    expect(ssoSqlConnection(`${base}?sslmode=require`).tls).toBe(true);
    expect(ssoSqlConnection(`${base}?sslmode=verify-full`).tls).toBe(true);
  });

  it('turns TLS off for disable', () => {
    expect(ssoSqlConnection(`${base}?sslmode=disable`, 'true').tls).toBe(false);
  });

  it('falls back to SSO_DATABASE_SSL without a mode', () => {
    expect(ssoSqlConnection(base, 'true').tls).toEqual({ rejectUnauthorized: false });
    expect(ssoSqlConnection(base).tls).toBe(false);
  });
});
