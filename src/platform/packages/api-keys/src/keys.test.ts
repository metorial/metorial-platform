import { describe, expect, it } from 'vitest';
import { UnifiedApiKey } from './keys';

describe('UnifiedApiKey', () => {
  it('creates and parses fine grained keys', () => {
    let key = UnifiedApiKey.create({
      type: 'fine_grained_token',
      config: {
        url: 'https://api.example.com',
        instance: 'v2-us1'
      }
    });

    let keyString = key.toString();
    expect(keyString.startsWith('metorial_fk_')).toBe(true);

    let parsed = UnifiedApiKey.from(keyString);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('fine_grained_token');
  });

  it('redacts fine grained keys', () => {
    let key = UnifiedApiKey.create({
      type: 'fine_grained_token',
      config: {
        url: 'https://api.example.com',
        instance: 'v2-eu1'
      }
    });

    let redacted = UnifiedApiKey.redact(key);
    expect(redacted.startsWith('metorial_fk_')).toBe(true);
    expect(redacted.includes('...')).toBe(true);
  });

  it('creates and parses oauth access and refresh keys', () => {
    let accessKey = UnifiedApiKey.create({
      type: 'oauth_access_token',
      config: {
        url: 'https://api.example.com',
        instance: 'v2-ext'
      }
    });

    let refreshKey = UnifiedApiKey.create({
      type: 'oauth_refresh_token',
      config: {
        url: 'https://api.example.com',
        instance: 'v2-ext'
      }
    });

    expect(accessKey.toString().startsWith('metorial_oa_')).toBe(true);
    expect(refreshKey.toString().startsWith('metorial_or_')).toBe(true);
    expect(UnifiedApiKey.from(accessKey.toString())?.type).toBe('oauth_access_token');
    expect(UnifiedApiKey.from(refreshKey.toString())?.type).toBe('oauth_refresh_token');
  });

  it('creates and parses keys for the v2-dev instance', () => {
    let key = UnifiedApiKey.create({
      type: 'instance_access_token_secret',
      config: {
        url: 'https://api.example.com',
        instance: 'v2-dev'
      }
    });

    let parsed = UnifiedApiKey.from(key.toString());
    expect(parsed).not.toBeNull();
    expect(parsed?.config.instance).toBe('v2-dev');
  });
});
