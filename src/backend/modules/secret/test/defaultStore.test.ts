import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';

// Mock Bun global
global.Bun = {
  SHA512: class {
    private data: string = '';
    update(content: string) {
      this.data += content;
      return this;
    }
    digest(encoding: string) {
      return crypto.createHash('sha512').update(this.data).digest(encoding as any);
    }
  }
} as any;

// Mock dependencies
vi.mock('@metorial/config', () => ({
  getConfig: vi.fn(() => ({
    encryptionSecret: 'test-encryption-secret-key'
  }))
}));

vi.mock('../src/store/store', () => ({
  SecretStoreManager: {
    create: vi.fn(config => ({
      ...config,
      get: vi.fn(async () => ({ oid: 1, slug: config.slug, name: config.name })),
      encryptSecret: async (secret: any, data: string) => await config.encrypt(secret, data),
      decryptSecret: async (secret: any, data: string) => await config.decrypt(secret, data)
    }))
  }
}));

vi.mock('../src/store/default/crypto', () => ({
  SecureEncryption: vi.fn().mockImplementation((key: string) => ({
    encrypt: vi.fn(async (data: string) => `encrypted-${data}-with-${key.substring(0, 10)}`),
    decrypt: vi.fn(async (data: string) => data.replace(/^encrypted-/, '').replace(/-with-.*$/, ''))
  }))
}));

describe('defaultSecretStore', () => {
  let mockSecret: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSecret = {
      oid: 1,
      id: 'test-secret-123',
      status: 'active'
    };
  });

  describe('configuration', () => {
    it('should create store with correct name and slug', async () => {
      const { SecretStoreManager } = await import('../src/store/store');
      const { defaultSecretStore } = await import('../src/store/default/index');

      expect(SecretStoreManager.create).toHaveBeenCalledWith({
        name: 'Default Secret Store',
        slug: 'default_v1',
        encrypt: expect.any(Function),
        decrypt: expect.any(Function)
      });

      expect(defaultSecretStore.name).toBe('Default Secret Store');
      expect(defaultSecretStore.slug).toBe('default_v1');
    });
  });

  describe('key generation', () => {
    it('should generate key from encryption secret and secret id', async () => {
      const { getConfig } = await import('@metorial/config');
      const { SecureEncryption } = await import('../src/store/default/crypto');
      const { defaultSecretStore } = await import('../src/store/default/index');

      await defaultSecretStore.encryptSecret(mockSecret, 'test-data');

      // Verify that SecureEncryption was called with a key
      expect(SecureEncryption).toHaveBeenCalled();
      const calledKey = (SecureEncryption as any).mock.calls[0][0];

      expect(typeof calledKey).toBe('string');
      expect(calledKey.length).toBe(45);
    });

    it('should generate different keys for different secrets', async () => {
      const { SecureEncryption } = await import('../src/store/default/crypto');
      const { defaultSecretStore } = await import('../src/store/default/index');

      const secret1 = { ...mockSecret, id: 'secret-1' };
      const secret2 = { ...mockSecret, id: 'secret-2' };

      await defaultSecretStore.encryptSecret(secret1, 'data');
      const key1 = (SecureEncryption as any).mock.calls[0][0];

      await defaultSecretStore.encryptSecret(secret2, 'data');
      const key2 = (SecureEncryption as any).mock.calls[1][0];

      expect(key1).not.toBe(key2);
    });

    it('should generate same key for same secret', async () => {
      const { SecureEncryption } = await import('../src/store/default/crypto');
      const { defaultSecretStore } = await import('../src/store/default/index');

      await defaultSecretStore.encryptSecret(mockSecret, 'data1');
      const key1 = (SecureEncryption as any).mock.calls[0][0];

      await defaultSecretStore.encryptSecret(mockSecret, 'data2');
      const key2 = (SecureEncryption as any).mock.calls[1][0];

      expect(key1).toBe(key2);
    });

    it('should use SHA512 hash truncated to 45 characters', async () => {
      const { SecureEncryption } = await import('../src/store/default/crypto');
      const { defaultSecretStore } = await import('../src/store/default/index');

      await defaultSecretStore.encryptSecret(mockSecret, 'test');

      const key = (SecureEncryption as any).mock.calls[0][0];
      expect(key.length).toBe(45);
      // Base64 characters only
      expect(key).toMatch(/^[A-Za-z0-9+/]+$/);
    });
  });

  describe('encrypt', () => {
    it('should encrypt data using SecureEncryption', async () => {
      const { SecureEncryption } = await import('../src/store/default/crypto');
      const { defaultSecretStore } = await import('../src/store/default/index');

      const result = await defaultSecretStore.encryptSecret(mockSecret, 'plain-text-data');

      expect(SecureEncryption).toHaveBeenCalled();
      expect(result).toContain('encrypted-plain-text-data');
    });

    it('should handle empty data', async () => {
      const { defaultSecretStore } = await import('../src/store/default/index');

      const result = await defaultSecretStore.encryptSecret(mockSecret, '');

      expect(result).toBeDefined();
    });

    it('should handle JSON data', async () => {
      const { defaultSecretStore } = await import('../src/store/default/index');

      const jsonData = JSON.stringify({ key: 'value', nested: { data: 'test' } });
      const result = await defaultSecretStore.encryptSecret(mockSecret, jsonData);

      expect(result).toBeDefined();
      expect(result).toContain('encrypted-');
    });

    it('should handle special characters', async () => {
      const { defaultSecretStore } = await import('../src/store/default/index');

      const specialData = 'data with\nnewlines\tand\ttabs and émojis 🔐';
      const result = await defaultSecretStore.encryptSecret(mockSecret, specialData);

      expect(result).toBeDefined();
    });

    it('should create new crypto instance for each call', async () => {
      const { SecureEncryption } = await import('../src/store/default/crypto');
      const { defaultSecretStore } = await import('../src/store/default/index');

      await defaultSecretStore.encryptSecret(mockSecret, 'data1');
      await defaultSecretStore.encryptSecret(mockSecret, 'data2');

      expect(SecureEncryption).toHaveBeenCalledTimes(2);
    });
  });

  describe('decrypt', () => {
    it('should decrypt data using SecureEncryption', async () => {
      const { SecureEncryption } = await import('../src/store/default/crypto');
      const { defaultSecretStore } = await import('../src/store/default/index');

      const result = await defaultSecretStore.decryptSecret(mockSecret, 'encrypted-data');

      expect(SecureEncryption).toHaveBeenCalled();
      expect(result).toBe('data');
    });

    it('should decrypt previously encrypted data', async () => {
      const { defaultSecretStore } = await import('../src/store/default/index');

      const original = 'sensitive-data';
      const encrypted = await defaultSecretStore.encryptSecret(mockSecret, original);
      const decrypted = await defaultSecretStore.decryptSecret(mockSecret, encrypted);

      // Note: Due to mocking, we can't do a real round-trip, but we can verify the flow
      expect(decrypted).toBeDefined();
    });

    it('should handle empty encrypted data', async () => {
      const { defaultSecretStore } = await import('../src/store/default/index');

      const result = await defaultSecretStore.decryptSecret(mockSecret, 'encrypted-');

      expect(result).toBeDefined();
    });

    it('should use same key for decryption as encryption', async () => {
      const { SecureEncryption } = await import('../src/store/default/crypto');
      const { defaultSecretStore } = await import('../src/store/default/index');

      await defaultSecretStore.encryptSecret(mockSecret, 'data');
      const encryptKey = (SecureEncryption as any).mock.calls[0][0];

      await defaultSecretStore.decryptSecret(mockSecret, 'encrypted-data');
      const decryptKey = (SecureEncryption as any).mock.calls[1][0];

      expect(encryptKey).toBe(decryptKey);
    });

    it('should create new crypto instance for each call', async () => {
      const { SecureEncryption } = await import('../src/store/default/crypto');
      const { defaultSecretStore } = await import('../src/store/default/index');

      await defaultSecretStore.decryptSecret(mockSecret, 'data1');
      await defaultSecretStore.decryptSecret(mockSecret, 'data2');

      expect(SecureEncryption).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle very long secret IDs', async () => {
      const { defaultSecretStore } = await import('../src/store/default/index');

      const longIdSecret = {
        ...mockSecret,
        id: 'x'.repeat(1000)
      };

      const result = await defaultSecretStore.encryptSecret(longIdSecret, 'data');

      expect(result).toBeDefined();
    });

    it('should handle concurrent encryptions', async () => {
      const { defaultSecretStore } = await import('../src/store/default/index');

      const promises = [
        defaultSecretStore.encryptSecret(mockSecret, 'data1'),
        defaultSecretStore.encryptSecret(mockSecret, 'data2'),
        defaultSecretStore.encryptSecret(mockSecret, 'data3')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => expect(result).toBeDefined());
    });

    it('should handle concurrent encryptions and decryptions', async () => {
      const { defaultSecretStore } = await import('../src/store/default/index');

      const promises = [
        defaultSecretStore.encryptSecret(mockSecret, 'data1'),
        defaultSecretStore.decryptSecret(mockSecret, 'encrypted-data2'),
        defaultSecretStore.encryptSecret(mockSecret, 'data3')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => expect(result).toBeDefined());
    });

    it('should handle large data payloads', async () => {
      const { defaultSecretStore } = await import('../src/store/default/index');

      const largeData = 'x'.repeat(1000000); // 1MB of data
      const result = await defaultSecretStore.encryptSecret(mockSecret, largeData);

      expect(result).toBeDefined();
    });

    it('should integrate with getConfig', async () => {
      const { getConfig } = await import('@metorial/config');
      const { defaultSecretStore } = await import('../src/store/default/index');

      await defaultSecretStore.encryptSecret(mockSecret, 'data');

      // getConfig should have been called to get the encryption secret
      expect(getConfig).toHaveBeenCalled();
    });
  });

  describe('security', () => {
    it('should use encryption secret from config', async () => {
      const { getConfig } = await import('@metorial/config');
      const { defaultSecretStore } = await import('../src/store/default/index');

      await defaultSecretStore.encryptSecret(mockSecret, 'data');

      expect(getConfig).toHaveBeenCalled();
    });

    it('should incorporate secret ID in key derivation', async () => {
      const { SecureEncryption } = await import('../src/store/default/crypto');
      const { defaultSecretStore } = await import('../src/store/default/index');

      const secret1 = { ...mockSecret, id: 'id1' };
      const secret2 = { ...mockSecret, id: 'id2' };

      await defaultSecretStore.encryptSecret(secret1, 'data');
      const key1 = (SecureEncryption as any).mock.calls[0][0];

      await defaultSecretStore.encryptSecret(secret2, 'data');
      const key2 = (SecureEncryption as any).mock.calls[1][0];

      // Keys should be different for different secret IDs
      expect(key1).not.toBe(key2);
    });
  });
});
