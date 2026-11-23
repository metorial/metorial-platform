import { describe, expect, test } from 'vitest';
import { isSensitiveLogField, redactSensitiveFields, redactSensitiveUrl } from './redact';

describe('isSensitiveLogField', () => {
  test.each([
    'secret',
    'clientSecret',
    'client_secret',
    'oidcClientSecret',
    'token',
    'accessToken',
    'refresh_token',
    'consumerToken',
    'connection_token',
    'password',
    'Authorization',
    'proxy-authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'apiKey',
    'privateKey',
    'key',
    'credentials',
    'code_verifier',
    'metorial-rpc-signature'
  ])('treats %s as sensitive', key => {
    expect(isSensitiveLogField(key)).toBe(true);
  });

  test.each([
    'secretId',
    'slateOAuthCredentialsId',
    'authConfigIds',
    'token_id',
    'apiKeyId',
    'name',
    'triggerKey',
    'idempotencyKey',
    'user-agent',
    'organizationId'
  ])('keeps %s', key => {
    expect(isSensitiveLogField(key)).toBe(false);
  });
});

describe('redactSensitiveFields', () => {
  test('redacts sensitive fields at any depth and keeps the rest', () => {
    let createdAt = new Date();

    expect(
      redactSensitiveFields({
        secretId: 'sec_1',
        secret: 'plaintext',
        createdAt,
        calls: [
          {
            name: 'secret:create',
            payload: { consumerToken: 'tok', nested: { clientSecret: { value: 'x' } } }
          }
        ]
      })
    ).toEqual({
      secretId: 'sec_1',
      secret: '[redacted]',
      createdAt,
      calls: [
        {
          name: 'secret:create',
          payload: {
            consumerToken: '[redacted]',
            nested: { clientSecret: { value: '[redacted]' } }
          }
        }
      ]
    });
  });

  test('keeps counters and flags stored under sensitive looking names', () => {
    expect(redactSensitiveFields({ maxTokens: 1000, hasSecret: true, token: null })).toEqual({
      maxTokens: 1000,
      hasSecret: true,
      token: null
    });
  });

  test('redacts every string below env, header and config containers', () => {
    expect(
      redactSensitiveFields({
        env: { DATABASE_URL: 'postgres://db/app', PORT: 8080 },
        requestHeaders: { 'x-custom': 'value' },
        userConfig: { region: 'eu', nested: [{ dsn: 'value' }] },
        slateInstanceConfigurationId: 'cfg_1'
      })
    ).toEqual({
      env: { DATABASE_URL: '[redacted]', PORT: 8080 },
      requestHeaders: { 'x-custom': '[redacted]' },
      userConfig: { region: '[redacted]', nested: [{ dsn: '[redacted]' }] },
      slateInstanceConfigurationId: 'cfg_1'
    });
  });

  test('redacts values that look like credentials under any name', () => {
    expect(
      redactSensitiveFields({
        a: 'Bearer abcdefghijklmnop',
        b: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl',
        c: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
        d: 'postgres://user:pass@db.internal/app',
        e: 'Basic plan for small teams',
        f: 'https://example.test/path'
      })
    ).toEqual({
      a: '[redacted]',
      b: '[redacted]',
      c: '[redacted]',
      d: '[redacted]',
      e: 'Basic plan for small teams',
      f: 'https://example.test/path'
    });
  });

  test('handles binary values, circular references and primitives', () => {
    let circular: Record<string, unknown> = { name: 'a', data: new Uint8Array([1, 2]) };
    circular.self = circular;

    expect(redactSensitiveFields(circular)).toEqual({
      name: 'a',
      data: '[redacted]',
      self: '[circular]'
    });
    expect(redactSensitiveFields(null)).toBe(null);
    expect(redactSensitiveFields('plain')).toBe('plain');
  });

  test('keeps identifiers and drops secrets from an auth object', () => {
    let expiresAt = new Date();

    expect(
      redactSensitiveFields({
        type: 'user',
        user: { id: 'usr_1', oid: 7n, email: 'a@example.test', passwordHash: 'hash' },
        session: { id: 'ses_1', clientSecret: 'secret-value', expiresAt },
        oauthToken: { id: 'oat_1', accessToken: 'at', refreshToken: 'rt' },
        apiKey: {
          id: 'apk_1',
          secret: 'metorial_sk_live',
          secretRedacted: 'metorial_sk_...ve'
        }
      })
    ).toEqual({
      type: 'user',
      user: { id: 'usr_1', oid: 7n, email: 'a@example.test', passwordHash: '[redacted]' },
      session: { id: 'ses_1', clientSecret: '[redacted]', expiresAt },
      oauthToken: { id: 'oat_1', accessToken: '[redacted]', refreshToken: '[redacted]' },
      apiKey: { id: 'apk_1', secret: '[redacted]', secretRedacted: '[redacted]' }
    });
  });

  test('redacts every string of an object stored under a sensitive name except identifiers', () => {
    expect(
      redactSensitiveFields({
        apiKey: { id: 'apk_1', organizationId: 'org_1', name: 'CI', secret: 'value' },
        tokens: ['a', 'b']
      })
    ).toEqual({
      apiKey: {
        id: 'apk_1',
        organizationId: 'org_1',
        name: '[redacted]',
        secret: '[redacted]'
      },
      tokens: ['[redacted]', '[redacted]']
    });
  });

  test('uses a custom field matcher when given one', () => {
    expect(
      redactSensitiveFields(
        { code: 'abc', secret: 'kept' },
        { isSensitive: key => key == 'code' }
      )
    ).toEqual({ code: '[redacted]', secret: 'kept' });
  });
});

describe('redactSensitiveUrl', () => {
  test('redacts sensitive query parameters and URL credentials', () => {
    let url = new URL(
      redactSensitiveUrl('https://user:pass@api.example.test/rpc?token=abc&key=def&page=2')
    );

    expect(url.searchParams.get('token')).toBe('[redacted]');
    expect(url.searchParams.get('key')).toBe('[redacted]');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.toString()).not.toContain('pass');
    expect(url.toString()).not.toContain('abc');
  });

  test('drops the query of a URL it cannot parse', () => {
    expect(redactSensitiveUrl('/rpc?token=abc')).toBe('/rpc');
  });
});
