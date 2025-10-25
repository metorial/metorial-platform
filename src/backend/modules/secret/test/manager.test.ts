import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  ensureSecretStore: vi.fn(async (fn: any) => {
    const data = fn();
    return {
      oid: 1,
      ...data
    };
  })
}));

describe('SecretStoreManager', () => {
  let mockSecret: any;
  let mockEncrypt: any;
  let mockDecrypt: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockSecret = {
      oid: 1,
      id: 'secret-123',
      status: 'active'
    };

    mockEncrypt = vi.fn(async (secret: any, data: string) => `encrypted-${data}`);
    mockDecrypt = vi.fn(async (secret: any, data: string) => data.replace('encrypted-', ''));
  });

  describe('create', () => {
    it('should create a SecretStoreManager instance', async () => {
      const { SecretStoreManager } = await import('../src/store/store');

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: mockDecrypt
      });

      expect(manager).toBeDefined();
      expect(manager.slug).toBe('test-store');
      expect(manager.name).toBe('Test Store');
    });

    it('should create manager with all required properties', async () => {
      const { SecretStoreManager } = await import('../src/store/store');

      const manager = SecretStoreManager.create({
        name: 'Custom Store',
        slug: 'custom-store',
        encrypt: mockEncrypt,
        decrypt: mockDecrypt
      });

      expect(manager.slug).toBe('custom-store');
      expect(manager.name).toBe('Custom Store');
      expect(typeof manager.encryptSecret).toBe('function');
      expect(typeof manager.decryptSecret).toBe('function');
      expect(typeof manager.get).toBe('function');
    });
  });

  describe('get', () => {
    it('should return the secret store', async () => {
      const { SecretStoreManager } = await import('../src/store/store');
      const { ensureSecretStore } = await import('@metorial/db');

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: mockDecrypt
      });

      const store = await manager.get();

      expect(store).toBeDefined();
      expect(ensureSecretStore).toHaveBeenCalled();
    });

    it('should call ensureSecretStore with correct parameters', async () => {
      const { SecretStoreManager } = await import('../src/store/store');
      const { ensureSecretStore } = await import('@metorial/db');

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: mockDecrypt
      });

      await manager.get();

      expect(ensureSecretStore).toHaveBeenCalledWith(expect.any(Function));

      // Verify the function passed to ensureSecretStore returns correct data
      const callArg = (ensureSecretStore as any).mock.calls[0][0];
      const result = callArg();
      expect(result).toEqual({
        slug: 'test-store',
        name: 'Test Store'
      });
    });

    it('should cache the store promise', async () => {
      const { SecretStoreManager } = await import('../src/store/store');
      const { ensureSecretStore } = await import('@metorial/db');

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: mockDecrypt
      });

      const store1 = await manager.get();
      const store2 = await manager.get();

      expect(store1).toBe(store2);
      // ensureSecretStore should only be called once during manager creation
      expect(ensureSecretStore).toHaveBeenCalledTimes(1);
    });
  });

  describe('encryptSecret', () => {
    it('should encrypt secret data', async () => {
      const { SecretStoreManager } = await import('../src/store/store');

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: mockDecrypt
      });

      const encrypted = await manager.encryptSecret(mockSecret, 'plain-data');

      expect(encrypted).toBe('encrypted-plain-data');
      expect(mockEncrypt).toHaveBeenCalledWith(mockSecret, 'plain-data');
    });

    it('should call get before encrypting', async () => {
      const { SecretStoreManager } = await import('../src/store/store');

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: mockDecrypt
      });

      const getSpy = vi.spyOn(manager, 'get');

      await manager.encryptSecret(mockSecret, 'test-data');

      expect(getSpy).toHaveBeenCalled();
    });

    it('should handle empty data', async () => {
      const { SecretStoreManager } = await import('../src/store/store');

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: mockDecrypt
      });

      const encrypted = await manager.encryptSecret(mockSecret, '');

      expect(encrypted).toBe('encrypted-');
      expect(mockEncrypt).toHaveBeenCalledWith(mockSecret, '');
    });

    it('should propagate encryption errors', async () => {
      const { SecretStoreManager } = await import('../src/store/store');

      const errorEncrypt = vi.fn(async () => {
        throw new Error('Encryption failed');
      });

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: errorEncrypt,
        decrypt: mockDecrypt
      });

      await expect(manager.encryptSecret(mockSecret, 'data')).rejects.toThrow('Encryption failed');
    });

    it('should handle large data', async () => {
      const { SecretStoreManager } = await import('../src/store/store');

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: mockDecrypt
      });

      const largeData = 'x'.repeat(10000);
      const encrypted = await manager.encryptSecret(mockSecret, largeData);

      expect(encrypted).toBe(`encrypted-${largeData}`);
      expect(mockEncrypt).toHaveBeenCalledWith(mockSecret, largeData);
    });
  });

  describe('decryptSecret', () => {
    it('should decrypt secret data', async () => {
      const { SecretStoreManager } = await import('../src/store/store');

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: mockDecrypt
      });

      const decrypted = await manager.decryptSecret(mockSecret, 'encrypted-data');

      expect(decrypted).toBe('data');
      expect(mockDecrypt).toHaveBeenCalledWith(mockSecret, 'encrypted-data');
    });

    it('should call get before decrypting', async () => {
      const { SecretStoreManager } = await import('../src/store/store');

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: mockDecrypt
      });

      const getSpy = vi.spyOn(manager, 'get');

      await manager.decryptSecret(mockSecret, 'encrypted-data');

      expect(getSpy).toHaveBeenCalled();
    });

    it('should handle empty encrypted data', async () => {
      const { SecretStoreManager } = await import('../src/store/store');

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: mockDecrypt
      });

      const decrypted = await manager.decryptSecret(mockSecret, 'encrypted-');

      expect(decrypted).toBe('');
      expect(mockDecrypt).toHaveBeenCalledWith(mockSecret, 'encrypted-');
    });

    it('should propagate decryption errors', async () => {
      const { SecretStoreManager } = await import('../src/store/store');

      const errorDecrypt = vi.fn(async () => {
        throw new Error('Decryption failed');
      });

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: errorDecrypt
      });

      await expect(manager.decryptSecret(mockSecret, 'data')).rejects.toThrow('Decryption failed');
    });

    it('should handle corrupted data', async () => {
      const { SecretStoreManager } = await import('../src/store/store');

      const corruptDecrypt = vi.fn(async () => {
        throw new Error('Invalid ciphertext');
      });

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: corruptDecrypt
      });

      await expect(manager.decryptSecret(mockSecret, 'corrupted')).rejects.toThrow('Invalid ciphertext');
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in data', async () => {
      const { SecretStoreManager } = await import('../src/store/store');

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: mockDecrypt
      });

      const specialData = '{"key": "value", "unicode": "\u00e9\u00e8\u00ea"}';
      const encrypted = await manager.encryptSecret(mockSecret, specialData);

      expect(mockEncrypt).toHaveBeenCalledWith(mockSecret, specialData);
    });

    it('should work with multiple secrets', async () => {
      const { SecretStoreManager } = await import('../src/store/store');

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: mockDecrypt
      });

      const secret1 = { ...mockSecret, id: 'secret-1' };
      const secret2 = { ...mockSecret, id: 'secret-2' };

      await manager.encryptSecret(secret1, 'data-1');
      await manager.encryptSecret(secret2, 'data-2');

      expect(mockEncrypt).toHaveBeenCalledTimes(2);
      expect(mockEncrypt).toHaveBeenNthCalledWith(1, secret1, 'data-1');
      expect(mockEncrypt).toHaveBeenNthCalledWith(2, secret2, 'data-2');
    });

    it('should handle concurrent operations', async () => {
      const { SecretStoreManager } = await import('../src/store/store');

      const manager = SecretStoreManager.create({
        name: 'Test Store',
        slug: 'test-store',
        encrypt: mockEncrypt,
        decrypt: mockDecrypt
      });

      const promises = [
        manager.encryptSecret(mockSecret, 'data-1'),
        manager.encryptSecret(mockSecret, 'data-2'),
        manager.decryptSecret(mockSecret, 'encrypted-data-3')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockEncrypt).toHaveBeenCalledTimes(2);
      expect(mockDecrypt).toHaveBeenCalledTimes(1);
    });
  });
});
