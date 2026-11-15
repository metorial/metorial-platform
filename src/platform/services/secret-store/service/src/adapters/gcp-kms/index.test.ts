import { beforeEach, describe, expect, it, vi } from 'vitest';

let gcp = vi.hoisted(() => ({ encrypt: vi.fn(), decrypt: vi.fn() }));

vi.mock('@google-cloud/kms', () => ({
  KeyManagementServiceClient: class {
    encrypt = gcp.encrypt;
    decrypt = gcp.decrypt;
  }
}));
vi.mock('../../env', () => ({
  env: {
    gcp: {
      GCP_KMS_DEFAULT_KEY:
        'projects/metorial-prod/locations/global/keyRings/ring/cryptoKeys/default',
      GCP_KMS_EXTERNAL_PRINCIPAL: 'nebula@metorial-prod.iam.gserviceaccount.com'
    }
  }
}));

import { GcpKmsKeyProviderAdapter } from './index';

let keyName = 'projects/customer/locations/global/keyRings/ring/cryptoKeys/key';
let context = {
  tenantId: 'tenant',
  tenantOid: 1n,
  keyProviderId: 'provider',
  keyProviderOid: 2n
};

describe('GcpKmsKeyProviderAdapter', () => {
  let adapter = new GcpKmsKeyProviderAdapter();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects malformed key names', async () => {
    await expect(adapter.validateKeyProvider({ keyName: 'nope' })).rejects.toMatchObject({
      code: 'gcp_key_name_invalid'
    });
  });

  it('rejects keys in Metorial-owned projects', async () => {
    await expect(
      adapter.validateKeyProvider({
        keyName: 'projects/metorial-prod/locations/global/keyRings/r/cryptoKeys/k'
      })
    ).rejects.toMatchObject({ code: 'gcp_key_project_invalid' });
  });

  it('validates access with an encrypt and decrypt round trip', async () => {
    gcp.encrypt.mockImplementation(async (req: any) => [{ ciphertext: req.plaintext }]);
    gcp.decrypt.mockImplementation(async (req: any) => [{ plaintext: req.ciphertext }]);

    let result = await adapter.validateKeyProvider({ keyName });

    expect(result.keyInfo).toMatchObject({
      variant: 'gcp_kms',
      keyName,
      projectId: 'customer'
    });
  });

  it('binds data keys to the encryption context', async () => {
    gcp.encrypt.mockResolvedValue([{ ciphertext: Buffer.from('ct'), name: `${keyName}/v1` }]);
    gcp.decrypt.mockResolvedValue([{ plaintext: Buffer.alloc(32, 1) }]);

    let provider: any = { keyInfo: { keyName } };
    let generated = await adapter.generateDataKey(provider, context);
    let aad = gcp.encrypt.mock.calls[0]![0].additionalAuthenticatedData;

    let plaintext = await adapter.decryptDataKey(
      provider,
      generated.encryptedDataKey,
      generated.keyInfo,
      context
    );

    expect(plaintext.length).toBe(32);
    expect(gcp.decrypt.mock.calls[0]![0].additionalAuthenticatedData).toEqual(aad);
  });
});
