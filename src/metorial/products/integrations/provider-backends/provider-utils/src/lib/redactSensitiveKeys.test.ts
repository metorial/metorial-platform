import { describe, expect, it } from 'vitest';
import { redactSensitiveKeys } from './redactSensitiveKeys';

describe('redactSensitiveKeys', () => {
  it('redacts known-sensitive keys in both casings', () => {
    expect(
      redactSensitiveKeys({
        accessToken: 'abc',
        access_token: 'abc',
        refreshToken: 'def',
        refresh_token: 'def',
        clientSecret: 'ghi',
        client_secret: 'ghi',
        code: 'jkl',
        state: 'mno',
        errorCode: 'token_refresh_failed'
      })
    ).toEqual({
      accessToken: '[REDACTED]',
      access_token: '[REDACTED]',
      refreshToken: '[REDACTED]',
      refresh_token: '[REDACTED]',
      clientSecret: '[REDACTED]',
      client_secret: '[REDACTED]',
      code: '[REDACTED]',
      state: '[REDACTED]',
      errorCode: 'token_refresh_failed'
    });
  });

  it('recurses through nested objects and arrays', () => {
    expect(
      redactSensitiveKeys({
        tokenResponse: { access_token: 'abc', scope: 'read' },
        attempts: [{ refreshToken: 'def' }, { refreshToken: 'ghi' }]
      })
    ).toEqual({
      tokenResponse: { access_token: '[REDACTED]', scope: 'read' },
      attempts: [{ refreshToken: '[REDACTED]' }, { refreshToken: '[REDACTED]' }]
    });
  });

  it('leaves non-sensitive scalars and structures untouched', () => {
    expect(redactSensitiveKeys({ authTokenId: 'auth_1', type: 'remote' })).toEqual({
      authTokenId: 'auth_1',
      type: 'remote'
    });
    expect(redactSensitiveKeys('hello')).toBe('hello');
    expect(redactSensitiveKeys(null)).toBe(null);
  });
});
