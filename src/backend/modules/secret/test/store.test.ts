import { ensureSecretStore, Secret, SecretStore } from '@metorial/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SecretStoreManager } from '../src/store/store';

vi.mock('@metorial/db', () => ({
  ensureSecretStore: vi.fn()
}));

describe('SecretStoreManager', () => {
  const slug = 'test-slug';
  const name = 'Test Store';
  const secret: Secret = { id: 'secret-id' } as Secret;
  const secretStore: SecretStore = { id: 'store-id' } as SecretStore;

  let encrypt: (secret: Secret, data: string) => Promise<string>;
  let decrypt: (secret: Secret, data: string) => Promise<string>;

  beforeEach(() => {
    // @ts-ignore
    (ensureSecretStore as unknown as vi.Mock).mockResolvedValue(secretStore);
    encrypt = vi.fn().mockResolvedValue('encrypted-data');
    decrypt = vi.fn().mockResolvedValue('decrypted-data');
  });

  it('should create an instance using static create', () => {
    const manager = SecretStoreManager.create({ name, slug, encrypt, decrypt });
    expect(manager).toBeInstanceOf(SecretStoreManager);
    expect(manager.name).toBe(name);
    expect(manager.slug).toBe(slug);
  });

  it('should call ensureSecretStore with correct arguments', async () => {
    SecretStoreManager.create({ name, slug, encrypt, decrypt });
    expect(ensureSecretStore).toHaveBeenCalledWith(expect.any(Function));
    // Check the function returns correct object
    // @ts-ignore
    const fn = (ensureSecretStore as vi.Mock).mock.calls[0][0];
    expect(fn()).toEqual({ slug, name });
  });

  it('get() should resolve to the secret store', async () => {
    const manager = SecretStoreManager.create({ name, slug, encrypt, decrypt });
    const store = await manager.get();
    expect(store).toBe(secretStore);
  });

  it('encryptSecret should call encrypt after store is ensured', async () => {
    const manager = SecretStoreManager.create({ name, slug, encrypt, decrypt });
    const result = await manager.encryptSecret(secret, 'plain');
    expect(encrypt).toHaveBeenCalledWith(secret, 'plain');
    expect(result).toBe('encrypted-data');
  });

  it('decryptSecret should call decrypt after store is ensured', async () => {
    const manager = SecretStoreManager.create({ name, slug, encrypt, decrypt });
    const result = await manager.decryptSecret(secret, 'cipher');
    expect(decrypt).toHaveBeenCalledWith(secret, 'cipher');
    expect(result).toBe('decrypted-data');
  });
});
