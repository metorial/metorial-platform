import { describe, expect, it } from 'vitest';
import { encodeBase62 } from './base62';
import { UnifiedApiKey } from './keys';

describe('UnifiedApiKey', () => {
  const validSecret = 'a'.repeat(60);
  const validConfig = { url: 'https://example.com' };
  const validType = 'user_auth_token';

  describe('UnifiedApiKey.create', () => {
    it('should create a valid UnifiedApiKey instance', () => {
      const apiKey = UnifiedApiKey.create({
        type: validType,
        secret: validSecret,
        config: validConfig
      });

      expect(apiKey).toBeInstanceOf(UnifiedApiKey);
      expect(apiKey.type).toBe(validType);
      expect(apiKey.config).toEqual(validConfig);
      expect(apiKey.version).toBe('v1');
    });

    it('should throw an error if the secret length is invalid', () => {
      expect(() =>
        UnifiedApiKey.create({
          type: validType,
          secret: 'short_secret',
          config: validConfig
        })
      ).toThrowError(`Secret key must be 60 characters long`);
    });
  });

  describe('UnifiedApiKey.from', () => {
    it('should parse a valid API key string', () => {
      const encodedConfig = encodeBase62(JSON.stringify([validConfig.url]));
      const apiKeyString = `metorial_uk_${validSecret}${encodedConfig}v1`;

      const apiKey = UnifiedApiKey.from(apiKeyString);

      expect(apiKey).toBeInstanceOf(UnifiedApiKey);
      expect(apiKey?.type).toBe(validType);
      expect(apiKey?.config).toEqual(validConfig);
      expect(apiKey?.version).toBe('v1');
    });

    it('should return null for an invalid API key string', () => {
      const invalidApiKeyString = 'invalid_key_string';
      const apiKey = UnifiedApiKey.from(invalidApiKeyString);

      expect(apiKey).toBeNull();
    });
  });

  describe('UnifiedApiKey.toString', () => {
    it('should serialize a UnifiedApiKey instance to a string', () => {
      const apiKey = UnifiedApiKey.create({
        type: validType,
        secret: validSecret,
        config: validConfig
      });

      const apiKeyString = apiKey.toString();
      const encodedConfig = encodeBase62(JSON.stringify([validConfig.url]));

      expect(apiKeyString).toBe(`metorial_uk_${validSecret}${encodedConfig}v1`);
    });
  });
});
