import {
  ClientCertificateCredential,
  ClientSecretCredential,
  DefaultAzureCredential
} from '@azure/identity';
import { CryptographyClient, KeyClient } from '@azure/keyvault-keys';
import { v } from '@lowerdeck/validation';
import { randomBytes, timingSafeEqual } from 'crypto';
import type { KeyProvider } from '../../../prisma/generated/client';
import { env } from '../../env';
import type {
  DataKeyContext,
  DataKeyResult,
  KeyProviderSetupInfoInput
} from '../_lib/adapter';
import { detag, KeyProviderAdapter } from '../_lib/adapter';
import { hashEncryptionContext } from '../_lib/context';
import { KeyProviderAdapterError, normalizeAdapterError } from '../_lib/errors';

let dataKeyLength = 32;

let allowedVaultHostSuffixes = [
  '.vault.azure.net',
  '.vault.azure.cn',
  '.vault.usgovcloudapi.net',
  '.managedhsm.azure.net',
  '.managedhsm.azure.cn',
  '.managedhsm.usgovcloudapi.net'
];

let keyNameRegex = /^[0-9a-zA-Z-]{1,127}$/;

let importKeyInputSchema = v.object({
  vaultUrl: v.string(),
  keyName: v.string()
});

type TokenCredential = ConstructorParameters<typeof KeyClient>[1];

let credential: TokenCredential | undefined;

let getCredential = () => {
  if (credential) return credential;

  let { AZURE_KMS_TENANT_ID: tenantId, AZURE_KMS_CLIENT_ID: clientId } = env.azure;
  let options = { additionallyAllowedTenants: ['*'] };

  if (tenantId && clientId && env.azure.AZURE_KMS_CLIENT_SECRET) {
    credential = new ClientSecretCredential(
      tenantId,
      clientId,
      env.azure.AZURE_KMS_CLIENT_SECRET,
      options
    );
  } else if (tenantId && clientId && env.azure.AZURE_KMS_CLIENT_CERTIFICATE_PEM) {
    credential = new ClientCertificateCredential(
      tenantId,
      clientId,
      { certificate: env.azure.AZURE_KMS_CLIENT_CERTIFICATE_PEM },
      options
    );
  } else if (tenantId && clientId && env.azure.AZURE_KMS_CLIENT_CERTIFICATE_PATH) {
    credential = new ClientCertificateCredential(
      tenantId,
      clientId,
      { certificatePath: env.azure.AZURE_KMS_CLIENT_CERTIFICATE_PATH },
      options
    );
  } else {
    credential = new DefaultAzureCredential(options);
  }

  return credential;
};

let normalizeVaultUrl = (raw: string) => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new KeyProviderAdapterError('azure_vault_url_invalid', 'Vault URL is invalid');
  }

  return url;
};

let assertTenantVaultUrl = (raw: string) => {
  let url = normalizeVaultUrl(raw);

  let isAllowedHost = allowedVaultHostSuffixes.some(suffix => url.hostname.endsWith(suffix));
  if (url.protocol !== 'https:' || url.port || !isAllowedHost) {
    throw new KeyProviderAdapterError(
      'azure_vault_url_invalid',
      'Vault URL must be an https Azure Key Vault or Managed HSM URL'
    );
  }

  let globalVaultUrl = env.azure.AZURE_KMS_DEFAULT_VAULT_URL;
  if (globalVaultUrl && normalizeVaultUrl(globalVaultUrl).origin === url.origin) {
    throw new KeyProviderAdapterError(
      'azure_vault_invalid',
      'Key vault must be owned by a customer Azure tenant'
    );
  }

  return url.origin;
};

let getAlgorithm = (keyType: string | undefined) => {
  if (keyType?.startsWith('RSA')) return 'RSA-OAEP-256' as const;
  if (keyType?.startsWith('oct')) return 'A256KW' as const;

  throw new KeyProviderAdapterError(
    'azure_key_type_unsupported',
    'Key must be an RSA or symmetric (oct-HSM) key'
  );
};

let toBuffer = (value: Uint8Array) => Buffer.from(value);

export class AzureKeyVaultKeyProviderAdapter extends KeyProviderAdapter {
  readonly type = 'azure_key_vault' as const;

  getSystemFingerprint() {
    return `azure_key_vault:${env.azure.AZURE_KMS_DEFAULT_VAULT_URL ?? ''}:${env.azure.AZURE_KMS_DEFAULT_KEY_NAME ?? ''}`;
  }

  async createSystemKeyProvider() {
    let vaultUrl = env.azure.AZURE_KMS_DEFAULT_VAULT_URL;
    let keyName = env.azure.AZURE_KMS_DEFAULT_KEY_NAME;
    if (!vaultUrl || !keyName) {
      throw new KeyProviderAdapterError(
        'azure_default_key_missing',
        'Default Azure Key Vault key is missing'
      );
    }

    try {
      let origin = normalizeVaultUrl(vaultUrl).origin;

      return {
        name: 'Metorial Azure Key Vault Default',
        keyInfo: {
          ...(await this.verifyKeyAccess({ vaultUrl: origin, keyName })),
          fingerprint: this.getSystemFingerprint()
        }
      };
    } catch (err) {
      throw normalizeAdapterError(err);
    }
  }

  async createTenantManagedKeyProvider(): Promise<{ name: string; keyInfo: any }> {
    throw new KeyProviderAdapterError(
      'azure_managed_keys_unsupported',
      'Metorial-managed keys are not available for Azure Key Vault'
    );
  }

  async validateKeyProvider(rawInput: Record<string, any>) {
    let parsedInput = importKeyInputSchema.validate(rawInput);
    if (!parsedInput.success) {
      throw new KeyProviderAdapterError(
        'invalid_key_input',
        'Invalid Azure Key Vault key input'
      );
    }

    let { vaultUrl, keyName } = parsedInput.value;
    if (!keyNameRegex.test(keyName)) {
      throw new KeyProviderAdapterError('azure_key_name_invalid', 'Key name is invalid');
    }

    let origin = assertTenantVaultUrl(vaultUrl);

    try {
      return {
        name: `Azure Key Vault Key (${keyName})`,
        keyInfo: {
          ...(await this.verifyKeyAccess({ vaultUrl: origin, keyName })),
          ts: Date.now()
        }
      };
    } catch (err) {
      throw normalizeAdapterError(err);
    }
  }

  async getSetupInfo(_input: KeyProviderSetupInfoInput) {
    let clientId = env.azure.AZURE_KMS_CLIENT_ID ?? '<metorial-client-id>';

    return {
      steps: [
        {
          title: 'Create or choose a key in Azure Key Vault',
          description:
            'Choose an RSA key (2048 bits or larger) or a symmetric oct-HSM key in a Key Vault or Managed HSM that uses Azure RBAC.'
        },
        {
          title: 'Grant admin consent to the Metorial application',
          description:
            'An administrator of your Microsoft Entra tenant must grant consent so that the Metorial application exists in your tenant.',
          markdown: detag`
            Open this URL as a tenant administrator:

            \`\`\`
            https://login.microsoftonline.com/organizations/adminconsent?client_id=${clientId}
            \`\`\`
          `
        },
        {
          title: 'Assign the Key Vault Crypto User role',
          description:
            'Allow the Metorial application to wrap and unwrap keys with the Key Vault Crypto User role on the vault or key.',
          markdown: detag`
            \`\`\`sh
            az role assignment create \\
              --assignee ${clientId} \\
              --role "Key Vault Crypto User" \\
              --scope <VAULT_OR_KEY_RESOURCE_ID>
            \`\`\`
          `
        },
        {
          title: 'Create the key provider',
          description:
            'Create the key provider after the role is assigned. Metorial validates access before storing it.',
          inputs: [
            {
              type: 'text' as const,
              key: 'vaultUrl',
              label: 'Vault URL',
              description: 'The vault URL, for example https://my-vault.vault.azure.net.'
            },
            {
              type: 'text' as const,
              key: 'keyName',
              label: 'Key name',
              description: 'The name of the key inside the vault.'
            }
          ]
        }
      ]
    };
  }

  async generateDataKey(
    keyProvider: KeyProvider,
    context: DataKeyContext
  ): Promise<DataKeyResult> {
    let keyInfo = keyProvider.keyInfo as any;
    let plaintextDataKey = randomBytes(dataKeyLength);

    try {
      let payload = Buffer.concat([hashEncryptionContext(context), plaintextDataKey]);
      let wrapped = await this.getCryptographyClient(keyInfo).wrapKey(
        keyInfo.algorithm,
        payload
      );

      return {
        plaintextDataKey,
        encryptedDataKey: wrapped.result,
        keyInfo: {
          variant: 'azure_key_vault',
          vaultUrl: keyInfo.vaultUrl,
          keyName: keyInfo.keyName,
          keyId: wrapped.keyID,
          algorithm: keyInfo.algorithm
        }
      };
    } catch (err) {
      throw normalizeAdapterError(err);
    }
  }

  async decryptDataKey(
    keyProvider: KeyProvider,
    encryptedDataKey: Uint8Array,
    keyInfo: any,
    context: DataKeyContext
  ) {
    if (keyInfo?.variant !== 'azure_key_vault') {
      throw new KeyProviderAdapterError(
        'invalid_key_info',
        'Invalid Azure Key Vault key info'
      );
    }

    try {
      let providerKeyInfo = keyProvider.keyInfo as any;
      let unwrapped = await this.getCryptographyClient({
        vaultUrl: keyInfo.vaultUrl ?? providerKeyInfo.vaultUrl,
        keyName: keyInfo.keyName ?? providerKeyInfo.keyName,
        keyId: keyInfo.keyId
      }).unwrapKey(keyInfo.algorithm ?? providerKeyInfo.algorithm, encryptedDataKey);

      let payload = toBuffer(unwrapped.result);
      let expectedHash = hashEncryptionContext(context);
      let isValid =
        payload.length === expectedHash.length + dataKeyLength &&
        timingSafeEqual(payload.subarray(0, expectedHash.length), expectedHash);

      if (!isValid) {
        throw new KeyProviderAdapterError(
          'azure_context_mismatch',
          'Azure Key Vault data key does not match the encryption context'
        );
      }

      return payload.subarray(expectedHash.length);
    } catch (err) {
      throw normalizeAdapterError(err);
    }
  }

  async describeKeyProvider(keyProvider: KeyProvider) {
    let keyInfo = keyProvider.keyInfo as any;

    return {
      type: 'azure_key_vault',
      vaultUrl: keyInfo.vaultUrl,
      keyName: keyInfo.keyName,
      algorithm: keyInfo.algorithm
    };
  }

  private getCryptographyClient(d: { vaultUrl: string; keyName: string; keyId?: string }) {
    return new CryptographyClient(
      d.keyId ?? `${d.vaultUrl}/keys/${d.keyName}`,
      getCredential()
    );
  }

  private async verifyKeyAccess(d: { vaultUrl: string; keyName: string }) {
    let key = await new KeyClient(d.vaultUrl, getCredential()).getKey(d.keyName);
    let algorithm = getAlgorithm(key.keyType);

    let client = this.getCryptographyClient(d);
    let probe = randomBytes(dataKeyLength);
    let wrapped = await client.wrapKey(algorithm, probe);
    let unwrapped = await client.unwrapKey(algorithm, wrapped.result);

    if (!Buffer.from(unwrapped.result).equals(probe)) {
      throw new KeyProviderAdapterError(
        'azure_validation_failed',
        'Azure Key Vault key did not return the expected plaintext'
      );
    }

    return {
      variant: 'azure_key_vault',
      vaultUrl: d.vaultUrl,
      keyName: d.keyName,
      algorithm
    };
  }
}
