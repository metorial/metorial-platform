import { beforeEach, describe, expect, it, vi } from 'vitest';

let azure = vi.hoisted(() => ({ getKey: vi.fn(), wrapKey: vi.fn(), unwrapKey: vi.fn() }));

vi.mock('@azure/identity', () => ({
  ClientSecretCredential: class {},
  ClientCertificateCredential: class {},
  DefaultAzureCredential: class {}
}));
vi.mock('@azure/keyvault-keys', () => ({
  KeyClient: class {
    getKey = azure.getKey;
  },
  CryptographyClient: class {
    wrapKey = azure.wrapKey;
    unwrapKey = azure.unwrapKey;
  }
}));
vi.mock('../../env', () => ({
  env: {
    azure: { AZURE_KMS_DEFAULT_VAULT_URL: 'https://metorial.vault.azure.net' }
  }
}));

import { AzureKeyVaultKeyProviderAdapter } from './index';

let context = {
  tenantId: 'tenant',
  tenantOid: 1n,
  keyProviderId: 'provider',
  keyProviderOid: 2n
};

describe('AzureKeyVaultKeyProviderAdapter', () => {
  let adapter = new AzureKeyVaultKeyProviderAdapter();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects vault URLs outside Azure', async () => {
    await expect(
      adapter.validateKeyProvider({ vaultUrl: 'https://evil.example.com', keyName: 'key' })
    ).rejects.toMatchObject({ code: 'azure_vault_url_invalid' });
  });

  it('rejects the Metorial-owned vault', async () => {
    await expect(
      adapter.validateKeyProvider({
        vaultUrl: 'https://metorial.vault.azure.net',
        keyName: 'key'
      })
    ).rejects.toMatchObject({ code: 'azure_vault_invalid' });
  });

  it('chooses the wrap algorithm from the key type', async () => {
    azure.getKey.mockResolvedValue({ keyType: 'RSA' });
    azure.wrapKey.mockImplementation(async (_alg: string, key: Uint8Array) => ({
      result: key
    }));
    azure.unwrapKey.mockImplementation(async (_alg: string, key: Uint8Array) => ({
      result: key
    }));

    let result = await adapter.validateKeyProvider({
      vaultUrl: 'https://customer.vault.azure.net/',
      keyName: 'key'
    });

    expect(result.keyInfo).toMatchObject({
      vaultUrl: 'https://customer.vault.azure.net',
      algorithm: 'RSA-OAEP-256'
    });
  });

  it('rejects data keys wrapped for a different context', async () => {
    let provider: any = {
      keyInfo: {
        vaultUrl: 'https://customer.vault.azure.net',
        keyName: 'key',
        algorithm: 'RSA-OAEP-256'
      }
    };
    azure.wrapKey.mockImplementation(async (_alg: string, payload: Uint8Array) => ({
      result: payload,
      keyID: 'https://customer.vault.azure.net/keys/key/v1'
    }));
    azure.unwrapKey.mockImplementation(async (_alg: string, payload: Uint8Array) => ({
      result: payload
    }));

    let generated = await adapter.generateDataKey(provider, context);

    let plaintext = await adapter.decryptDataKey(
      provider,
      generated.encryptedDataKey,
      generated.keyInfo,
      context
    );
    expect(Buffer.from(plaintext).equals(Buffer.from(generated.plaintextDataKey))).toBe(true);

    await expect(
      adapter.decryptDataKey(provider, generated.encryptedDataKey, generated.keyInfo, {
        ...context,
        tenantId: 'other'
      })
    ).rejects.toMatchObject({ code: 'azure_context_mismatch' });
  });
});
