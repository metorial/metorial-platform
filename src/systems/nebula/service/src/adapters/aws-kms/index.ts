import {
  CreateKeyCommand,
  DecryptCommand,
  DescribeKeyCommand,
  GenerateDataKeyCommand,
  KMSClient
} from '@aws-sdk/client-kms';
import type { KeyProvider } from '../../../prisma/generated/client';
import { env } from '../../env';
import type {
  AdapterKeyProviderInput,
  DataKeyContext,
  DataKeyResult
} from '../_lib/adapter';
import { NebulaKeyProviderAdapter } from '../_lib/adapter';
import { NebulaAdapterError, normalizeAdapterError } from '../_lib/errors';

let getKmsClient = (region?: string) =>
  new KMSClient({
    region: region ?? env.kms.KMS_AWS_REGION,
    credentials:
      env.kms.KMS_AWS_ACCESS_KEY_ID && env.kms.KMS_AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env.kms.KMS_AWS_ACCESS_KEY_ID,
            secretAccessKey: env.kms.KMS_AWS_SECRET_ACCESS_KEY
          }
        : undefined
  });

let getEncryptionContext = (context: DataKeyContext) => ({
  tenantId: context.tenantId,
  tenantOid: String(context.tenantOid),
  keyProviderId: context.keyProviderId,
  keyProviderOid: String(context.keyProviderOid)
});

export class AwsKmsKeyProviderAdapter extends NebulaKeyProviderAdapter {
  readonly type = 'aws_kms' as const;

  async createSystemKeyProvider() {
    let region = env.kms.KMS_AWS_REGION;
    if (!region) throw new NebulaAdapterError('kms_region_missing', 'KMS region is missing');

    let keyId = env.kms.KMS_DEFAULT_KEY_ID;

    try {
      if (!keyId && env.kms.KMS_CREATE_DEFAULT_KEY === 'true') {
        let created = await getKmsClient(region).send(
          new CreateKeyCommand({
            Description: 'Nebula default data-key KMS key',
            KeyUsage: 'ENCRYPT_DECRYPT',
            KeySpec: 'SYMMETRIC_DEFAULT',
            Tags: [{ TagKey: 'metorial-system', TagValue: 'nebula' }]
          })
        );
        keyId = created.KeyMetadata?.Arn ?? created.KeyMetadata?.KeyId;
      }

      if (!keyId) {
        throw new NebulaAdapterError('kms_default_key_missing', 'Default KMS key is missing');
      }

      return {
        name: 'Nebula AWS KMS Default',
        keyInfo: await this.describeKeyId({ keyId, region })
      };
    } catch (err) {
      throw normalizeAdapterError(err);
    }
  }

  async validateKeyProvider(input: AdapterKeyProviderInput) {
    if (input.type !== 'aws_kms') {
      throw new NebulaAdapterError('invalid_provider_type', 'Invalid AWS KMS provider input');
    }

    let region = input.region ?? env.kms.KMS_AWS_REGION;
    if (!input.keyId) throw new NebulaAdapterError('kms_key_missing', 'KMS key is missing');
    if (!region) throw new NebulaAdapterError('kms_region_missing', 'KMS region is missing');

    try {
      return {
        keyInfo: await this.describeKeyId({ keyId: input.keyId, region })
      };
    } catch (err) {
      throw normalizeAdapterError(err);
    }
  }

  async createTenantManagedKeyProvider(input: {
    tenantId: string;
    tenantIdentifier: string;
    name: string;
    systemIdentifier: string;
    region?: string;
  }) {
    let region = input.region ?? env.kms.KMS_AWS_REGION;
    if (!region) throw new NebulaAdapterError('kms_region_missing', 'KMS region is missing');

    try {
      let created = await getKmsClient(region).send(
        new CreateKeyCommand({
          Description: `Nebula tenant data-key KMS key for ${input.tenantIdentifier}`,
          KeyUsage: 'ENCRYPT_DECRYPT',
          KeySpec: 'SYMMETRIC_DEFAULT',
          Tags: [
            { TagKey: 'metorial-system', TagValue: 'nebula' },
            { TagKey: 'nebula-managed', TagValue: 'true' },
            { TagKey: 'nebula-tenant-id', TagValue: input.tenantId },
            { TagKey: 'nebula-key-provider', TagValue: input.systemIdentifier }
          ]
        })
      );

      let keyId = created.KeyMetadata?.Arn ?? created.KeyMetadata?.KeyId;
      if (!keyId) throw new NebulaAdapterError('kms_key_missing', 'KMS key is missing');

      return {
        name: input.name,
        keyInfo: {
          ...(await this.describeKeyId({ keyId, region })),
          managedByNebula: true,
          tenantId: input.tenantId
        }
      };
    } catch (err) {
      throw normalizeAdapterError(err);
    }
  }

  async generateDataKey(keyProvider: KeyProvider, context: DataKeyContext): Promise<DataKeyResult> {
    let keyInfo = keyProvider.keyInfo as any;

    try {
      let result = await getKmsClient(keyInfo.region).send(
        new GenerateDataKeyCommand({
          KeyId: keyInfo.keyArn ?? keyInfo.keyId,
          KeySpec: 'AES_256',
          EncryptionContext: getEncryptionContext(context)
        })
      );

      if (!result.Plaintext || !result.CiphertextBlob) {
        throw new NebulaAdapterError('kms_data_key_missing', 'KMS did not return a data key');
      }

      return {
        plaintextDataKey: result.Plaintext,
        encryptedDataKey: result.CiphertextBlob,
        keyInfo: {
          variant: 'aws_kms',
          region: keyInfo.region,
          keyId: keyInfo.keyId,
          keyArn: keyInfo.keyArn
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
    if (keyInfo?.variant !== 'aws_kms') {
      throw new NebulaAdapterError('invalid_key_info', 'Invalid AWS KMS key info');
    }

    try {
      let result = await getKmsClient(keyInfo.region).send(
        new DecryptCommand({
          KeyId: keyInfo.keyArn ?? keyInfo.keyId ?? (keyProvider.keyInfo as any).keyArn,
          CiphertextBlob: encryptedDataKey,
          EncryptionContext: getEncryptionContext(context)
        })
      );

      if (!result.Plaintext) {
        throw new NebulaAdapterError('kms_plaintext_missing', 'KMS did not return plaintext');
      }

      return result.Plaintext;
    } catch (err) {
      throw normalizeAdapterError(err);
    }
  }

  async describeKeyProvider(keyProvider: KeyProvider) {
    let keyInfo = keyProvider.keyInfo as any;
    return {
      type: 'aws_kms',
      region: keyInfo.region,
      keyId: keyInfo.keyId,
      keyArn: keyInfo.keyArn
    };
  }

  private async describeKeyId(d: { keyId: string; region: string }) {
    let described = await getKmsClient(d.region).send(
      new DescribeKeyCommand({
        KeyId: d.keyId
      })
    );

    return {
      variant: 'aws_kms',
      region: d.region,
      keyId: described.KeyMetadata?.KeyId ?? d.keyId,
      keyArn: described.KeyMetadata?.Arn ?? d.keyId,
      accountId: described.KeyMetadata?.AWSAccountId
    };
  }
}
