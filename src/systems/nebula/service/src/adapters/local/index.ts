import type { KeyProvider } from '../../../prisma/generated/client';
import { env } from '../../env';
import { decryptAes256Gcm, deriveSha256Key, encryptAes256Gcm } from '../../lib/crypto';
import type {
  DataKeyContext,
  DataKeyResult,
  KeyProviderSetupInfoInput
} from '../_lib/adapter';
import { detag } from '../_lib/adapter';
import { NebulaKeyProviderAdapter } from '../_lib/adapter';
import { NebulaAdapterError } from '../_lib/errors';

let assertLocalAllowed = () => {
  if (process.env.NODE_ENV === 'production') {
    throw new NebulaAdapterError('local_provider_in_production', 'Local provider cannot be used in production');
  }
};

let getMasterKey = (keyProvider?: KeyProvider) => {
  assertLocalAllowed();

  let secret = (keyProvider?.keyInfo as any)?.secret ?? env.local.LOCAL_MASTER_SECRET;
  if (!secret) throw new NebulaAdapterError('local_secret_missing', 'Local master secret is missing');
  return deriveSha256Key(secret);
};

export class LocalKeyProviderAdapter extends NebulaKeyProviderAdapter {
  readonly type = 'local' as const;

  async createSystemKeyProvider() {
    assertLocalAllowed();
    getMasterKey();

    return {
      name: 'Nebula Local Default',
      keyInfo: {
        variant: 'local',
        version: 1
      }
    };
  }

  async validateKeyProvider(_input: Record<string, any>) {
    assertLocalAllowed();

    getMasterKey();

    return {
      name: 'Nebula Local KeyProvider',
      keyInfo: {
        variant: 'local',
        version: 1
      }
    };
  }

  async createTenantManagedKeyProvider(input: {
    name: string;
  }): Promise<{
    name: string;
    keyInfo: any;
  }> {
    assertLocalAllowed();

    return {
      name: input.name,
      keyInfo: {
        variant: 'local',
        version: 1,
        managedByNebula: true,
        secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
      }
    };
  }

  async getSetupInfo(input: KeyProviderSetupInfoInput) {
    let importKeyProviderPayload = {
      tenantId: input.tenantId,
      keyInput: {
        testKeyId: 'local-test-key',
        environment: 'development',
        owner: input.tenantIdentifier
      }
    };
    let createProviderMarkdown = detag`
      Example \`keyProvider.import\` payload:

      \`\`\`json
      ${JSON.stringify(importKeyProviderPayload, null, 2)}
      \`\`\`
    `;
    let steps = [
      {
        title: 'Choose a local test key identifier',
        description:
          'Pick a stable identifier for this local test key. Nebula accepts these values for a realistic setup flow, but the local adapter does not use them for encryption.',
        inputs: [
          {
            type: 'text' as const,
            key: 'testKeyId',
            label: 'Test key ID',
            description: 'A local-only key identifier to help you recognize this test KeyProvider.'
          },
          {
            type: 'text' as const,
            key: 'environment',
            label: 'Environment',
            description: 'A label such as development, test, or ci.'
          }
        ]
      },
      {
        title: 'Configure the local master secret',
        description:
          'Set LOCAL_MASTER_SECRET to a high-entropy value with at least 32 characters before starting Nebula locally. Local mode is blocked in production.',
        inputs: [
          {
            type: 'text' as const,
            key: 'localMasterSecretRef',
            label: 'Local master secret reference',
            description: 'A note or reference for where your local LOCAL_MASTER_SECRET is configured. Do not send the actual secret value.'
          }
        ]
      },
      {
        title: 'Create the local KeyProvider',
        description: `Create the local KeyProvider for tenant ${input.tenantIdentifier}. No external cloud setup is required.`,
        markdown: createProviderMarkdown,
        inputs: [
          {
            type: 'json' as const,
            key: 'keyInput',
            label: 'Local test key input',
            description: 'Testing metadata to send as keyInput. The local adapter accepts it but ignores it for cryptographic operations.'
          }
        ]
      }
    ];

    return {
      steps,
      markdown: detag`
        Tenant: \`${input.tenantIdentifier}\`

        ${steps.flatMap(step => step.markdown ?? []).join('\n\n')}
      `
    };
  }

  async generateDataKey(keyProvider: KeyProvider, context: DataKeyContext): Promise<DataKeyResult> {
    let plaintextDataKey = crypto.getRandomValues(new Uint8Array(32));
    let wrapped = encryptAes256Gcm({
      key: getMasterKey(keyProvider),
      plaintext: plaintextDataKey,
      aad: Buffer.from(this.getAad(context), 'utf8')
    });

    return {
      plaintextDataKey,
      encryptedDataKey: Buffer.concat([
        Buffer.from(wrapped.iv),
        Buffer.from(wrapped.authTag),
        Buffer.from(wrapped.ciphertext)
      ]),
      keyInfo: {
        variant: 'local',
        version: 1,
        providerId: keyProvider.id,
        managedByNebula: (keyProvider.keyInfo as any)?.managedByNebula === true
      }
    };
  }

  async decryptDataKey(
    keyProvider: KeyProvider,
    encryptedDataKey: Uint8Array,
    keyInfo: any,
    context: DataKeyContext
  ) {
    if (keyInfo?.variant !== 'local') {
      throw new NebulaAdapterError('invalid_key_info', 'Invalid local key info');
    }

    let buffer = Buffer.from(encryptedDataKey);
    if (buffer.length < 29) {
      throw new NebulaAdapterError('invalid_encrypted_data_key', 'Invalid encrypted data key');
    }

    return decryptAes256Gcm({
      key: getMasterKey(keyProvider),
      iv: buffer.subarray(0, 12),
      authTag: buffer.subarray(12, 28),
      ciphertext: buffer.subarray(28),
      aad: Buffer.from(this.getAad(context), 'utf8')
    });
  }

  async describeKeyProvider() {
    return {
      type: 'local',
      managed: true
    };
  }

  private getAad(context: DataKeyContext) {
    return `nebula:data-key:${context.tenantId}:${context.keyProviderId}`;
  }
}
