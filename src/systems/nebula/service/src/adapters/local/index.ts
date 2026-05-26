import type { KeyProvider } from '../../../prisma/generated/client';
import { env } from '../../env';
import { decryptAes256Gcm, deriveSha256Key, encryptAes256Gcm } from '../../lib/crypto';
import type {
  AdapterKeyProviderInput,
  DataKeyContext,
  DataKeyResult
} from '../_lib/adapter';
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

  async validateKeyProvider(input: AdapterKeyProviderInput) {
    assertLocalAllowed();

    if (input.type !== 'local') {
      throw new NebulaAdapterError('invalid_provider_type', 'Invalid local provider input');
    }

    getMasterKey();

    return {
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
