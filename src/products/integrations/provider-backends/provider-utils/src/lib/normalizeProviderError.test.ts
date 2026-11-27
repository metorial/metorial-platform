import { describe, expect, it } from 'vitest';
import { normalizeProviderError, redactSensitiveText } from './normalizeProviderError';

describe('redactSensitiveText', () => {
  it('removes urls, bearer tokens and long opaque strings', () => {
    let redacted = redactSensitiveText(
      'GET https://api.example.com/mcp failed, authorization: Bearer sk-1234567890abcdefghijklmnopqrstuvwxyz'
    );

    expect(redacted).not.toContain('api.example.com');
    expect(redacted).not.toContain('sk-1234567890abcdefghijklmnopqrstuvwxyz');
    expect(redacted).toContain('[redacted');
  });

  it('redacts assigned secrets regardless of casing', () => {
    let redacted = redactSensitiveText('client_secret="s3cret-value-1234"');
    expect(redacted).not.toContain('s3cret-value-1234');
  });
});

describe('normalizeProviderError', () => {
  it('maps http status codes onto stable codes', () => {
    expect(normalizeProviderError({ status: 401 }).code).toBe('provider_auth_failed');
    expect(normalizeProviderError({ status: 429 }).code).toBe('provider_overloaded');
    expect(normalizeProviderError({ status: 503 }).code).toBe('provider_unreachable');
  });

  it('maps backend error codes and envelopes', () => {
    expect(normalizeProviderError({ code: 'egress_policy_blocked' }).code).toBe(
      'egress_policy_blocked'
    );
    expect(normalizeProviderError({ error: { code: 'auth_token_refresh_failed' } }).code).toBe(
      'provider_auth_expired'
    );
  });

  it('falls back to message heuristics and then the fallback code', () => {
    expect(normalizeProviderError(new Error('request timed out')).code).toBe(
      'provider_request_timeout'
    );
    expect(normalizeProviderError({}, 'provider_unreachable').code).toBe(
      'provider_unreachable'
    );
  });

  it('never leaks the raw message into the client-facing message', () => {
    let normalized = normalizeProviderError(
      new Error('connect ECONNREFUSED https://secret-host.internal/mcp?token=abcdef1234567890')
    );

    expect(normalized.code).toBe('provider_unreachable');
    expect(normalized.message).not.toContain('secret-host.internal');
    expect(normalized.detail).not.toContain('secret-host.internal');
  });
});
