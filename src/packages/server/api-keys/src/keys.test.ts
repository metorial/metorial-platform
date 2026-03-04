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
});
