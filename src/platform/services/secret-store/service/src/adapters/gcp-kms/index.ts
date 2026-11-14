import { KeyManagementServiceClient } from '@google-cloud/kms';
import { v } from '@lowerdeck/validation';
import { randomBytes } from 'crypto';
import type { KeyProvider } from '../../../prisma/generated/client';
import { env } from '../../env';
import type {
  DataKeyContext,
  DataKeyResult,
  KeyProviderSetupInfoInput
} from '../_lib/adapter';
import { detag, KeyProviderAdapter } from '../_lib/adapter';
import { encodeEncryptionContext } from '../_lib/context';
import { KeyProviderAdapterError, normalizeAdapterError } from '../_lib/errors';

let dataKeyLength = 32;

let importKeyInputSchema = v.object({
  keyName: v.string()
});

let cryptoKeyNameRegex =
  /^projects\/([^/]+)\/locations\/([^/]+)\/keyRings\/([^/]+)\/cryptoKeys\/([^/]+)$/;

let serviceAccountProjectRegex = /@([^.]+)\.iam\.gserviceaccount\.com$/;

let client: KeyManagementServiceClient | undefined;

let getClient = () => {
  if (client) return client;

  let credentialsJson = env.gcp.GCP_KMS_CREDENTIALS_JSON;

  client = new KeyManagementServiceClient({
    fallback: 'rest',
    ...(credentialsJson ? { credentials: JSON.parse(credentialsJson) } : {})
  });

  return client;
};

let parseCryptoKeyName = (keyName: string) => {
  let match = keyName.match(cryptoKeyNameRegex);
  if (!match) {
    throw new KeyProviderAdapterError(
      'gcp_key_name_invalid',
      'GCP KMS key must be provided as projects/<project>/locations/<location>/keyRings/<key ring>/cryptoKeys/<key>'
    );
  }

  return {
    keyName,
    projectId: match[1]!,
    location: match[2]!,
    keyRing: match[3]!,
    key: match[4]!
  };
};

let getReservedProjects = () => {
  let projects = new Set<string>();

  let defaultKey = env.gcp.GCP_KMS_DEFAULT_KEY?.match(cryptoKeyNameRegex);
  if (defaultKey) projects.add(defaultKey[1]!);

  let principalProject = env.gcp.GCP_KMS_EXTERNAL_PRINCIPAL?.match(
    serviceAccountProjectRegex
  )?.[1];
  if (principalProject) projects.add(principalProject);

  return projects;
};

let toBuffer = (value: string | Uint8Array | null | undefined) =>
  typeof value === 'string' ? Buffer.from(value, 'base64') : value ? Buffer.from(value) : null;

export class GcpKmsKeyProviderAdapter extends KeyProviderAdapter {
  readonly type = 'gcp_kms' as const;

  getSystemFingerprint() {
    return `gcp_kms:${env.gcp.GCP_KMS_DEFAULT_KEY ?? ''}`;
  }

  async createSystemKeyProvider() {
    let keyName = env.gcp.GCP_KMS_DEFAULT_KEY;
    if (!keyName) {
      throw new KeyProviderAdapterError(
        'gcp_default_key_missing',
        'Default GCP KMS key is missing'
      );
    }

    try {
      let parsed = parseCryptoKeyName(keyName);
      await this.verifyKeyAccess(parsed.keyName);

      return {
        name: 'Metorial GCP KMS Default',
        keyInfo: {
          variant: 'gcp_kms',
          ...parsed,
          fingerprint: this.getSystemFingerprint()
        }
      };
    } catch (err) {
      throw normalizeAdapterError(err);
    }
  }

  async createTenantManagedKeyProvider(): Promise<{ name: string; keyInfo: any }> {
    throw new KeyProviderAdapterError(
      'gcp_managed_keys_unsupported',
      'Metorial-managed keys are not available for GCP KMS'
    );
  }

  async validateKeyProvider(rawInput: Record<string, any>) {
    let parsedInput = importKeyInputSchema.validate(rawInput);
    if (!parsedInput.success) {
      throw new KeyProviderAdapterError('invalid_key_input', 'Invalid GCP KMS key input');
    }

    let parsed = parseCryptoKeyName(parsedInput.value.keyName);
    if (getReservedProjects().has(parsed.projectId)) {
      throw new KeyProviderAdapterError(
        'gcp_key_project_invalid',
        'KMS key must be owned by a customer GCP project'
      );
    }

    try {
      await this.verifyKeyAccess(parsed.keyName);

      return {
        name: `GCP KMS Key (${parsed.key})`,
        keyInfo: { variant: 'gcp_kms', ...parsed, ts: Date.now() }
      };
    } catch (err) {
      throw normalizeAdapterError(err);
    }
  }

  async getSetupInfo(_input: KeyProviderSetupInfoInput) {
    let principal = env.gcp.GCP_KMS_EXTERNAL_PRINCIPAL ?? '<metorial-service-account>';

    return {
      steps: [
        {
          title: 'Create or choose a symmetric Cloud KMS key',
          description:
            'Choose a Cloud KMS key with the purpose "Symmetric encrypt/decrypt". Asymmetric keys are not supported.'
        },
        {
          title: 'Grant the Metorial service account access to the key',
          description:
            'Grant the Cloud KMS CryptoKey Encrypter/Decrypter role on the key to the Metorial service account.',
          markdown: detag`
            \`\`\`sh
            gcloud kms keys add-iam-policy-binding <KEY> \\
              --keyring <KEY_RING> \\
              --location <LOCATION> \\
              --project <PROJECT> \\
              --member "serviceAccount:${principal}" \\
              --role "roles/cloudkms.cryptoKeyEncrypterDecrypter"
            \`\`\`
          `
        },
        {
          title: 'Create the key provider',
          description:
            'Create the key provider after the role is granted. Metorial validates access before storing it.',
          inputs: [
            {
              type: 'text' as const,
              key: 'keyName',
              label: 'Cloud KMS key name',
              description:
                'The full resource name, for example projects/my-project/locations/global/keyRings/my-ring/cryptoKeys/my-key.'
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
      let [result] = await getClient().encrypt({
        name: keyInfo.keyName,
        plaintext: plaintextDataKey,
        additionalAuthenticatedData: encodeEncryptionContext(context)
      });

      let ciphertext = toBuffer(result.ciphertext);
      if (!ciphertext) {
        throw new KeyProviderAdapterError(
          'gcp_ciphertext_missing',
          'GCP KMS did not return a ciphertext'
        );
      }

      return {
        plaintextDataKey,
        encryptedDataKey: ciphertext,
        keyInfo: {
          variant: 'gcp_kms',
          keyName: keyInfo.keyName,
          keyVersion: result.name
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
    if (keyInfo?.variant !== 'gcp_kms') {
      throw new KeyProviderAdapterError('invalid_key_info', 'Invalid GCP KMS key info');
    }

    try {
      let [result] = await getClient().decrypt({
        name: keyInfo.keyName ?? (keyProvider.keyInfo as any).keyName,
        ciphertext: encryptedDataKey,
        additionalAuthenticatedData: encodeEncryptionContext(context)
      });

      let plaintext = toBuffer(result.plaintext);
      if (!plaintext || plaintext.length !== dataKeyLength) {
        throw new KeyProviderAdapterError(
          'gcp_plaintext_invalid',
          'GCP KMS returned an invalid data key'
        );
      }

      return plaintext;
    } catch (err) {
      throw normalizeAdapterError(err);
    }
  }

  async describeKeyProvider(keyProvider: KeyProvider) {
    let keyInfo = keyProvider.keyInfo as any;

    return {
      type: 'gcp_kms',
      keyName: keyInfo.keyName,
      projectId: keyInfo.projectId,
      location: keyInfo.location
    };
  }

  private async verifyKeyAccess(keyName: string) {
    let probe = randomBytes(dataKeyLength);
    let aad = Buffer.from('metorial-key-provider-validation');

    let [encrypted] = await getClient().encrypt({
      name: keyName,
      plaintext: probe,
      additionalAuthenticatedData: aad
    });
    let [decrypted] = await getClient().decrypt({
      name: keyName,
      ciphertext: encrypted.ciphertext,
      additionalAuthenticatedData: aad
    });

    let plaintext = toBuffer(decrypted.plaintext);
    if (!plaintext || !plaintext.equals(probe)) {
      throw new KeyProviderAdapterError(
        'gcp_validation_failed',
        'GCP KMS key did not return the expected plaintext'
      );
    }
  }
}
