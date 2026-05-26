import {
  CreateKeyCommand,
  DecryptCommand,
  DescribeKeyCommand,
  GenerateDataKeyCommand,
  KMSClient
} from '@aws-sdk/client-kms';
import { v } from '@lowerdeck/validation';
import type { KeyProvider } from '../../../prisma/generated/client';
import { env } from '../../env';
import type {
  DataKeyContext,
  DataKeyResult,
  KeyProviderSetupInfoInput
} from '../_lib/adapter';
import { detag, KeyProviderAdapter } from '../_lib/adapter';
import { KeyProviderAdapterError, normalizeAdapterError } from '../_lib/errors';

let importKeyInputSchema = v.object({
  keyId: v.string(),
  region: v.optional(v.string())
});

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

export class AwsKmsKeyProviderAdapter extends KeyProviderAdapter {
  readonly type = 'aws_kms' as const;

  async createSystemKeyProvider() {
    let region = env.kms.KMS_AWS_REGION;
    if (!region) throw new KeyProviderAdapterError('kms_region_missing', 'KMS region is missing');

    let keyId = env.kms.KMS_DEFAULT_KEY_ID;

    try {
      if (!keyId && env.kms.KMS_CREATE_DEFAULT_KEY === 'true') {
        let created = await getKmsClient(region).send(
          new CreateKeyCommand({
            Description: 'Metorial default data-key KMS key',
            KeyUsage: 'ENCRYPT_DECRYPT',
            KeySpec: 'SYMMETRIC_DEFAULT',
            Tags: [{ TagKey: 'metorial-system', TagValue: 'nebula' }]
          })
        );
        keyId = created.KeyMetadata?.Arn ?? created.KeyMetadata?.KeyId;
      }

      if (!keyId) {
        throw new KeyProviderAdapterError('kms_default_key_missing', 'Default KMS key is missing');
      }

      return {
        name: 'Metorial AWS KMS Default',
        keyInfo: await this.describeKeyId({ keyId, region })
      };
    } catch (err) {
      throw normalizeAdapterError(err);
    }
  }

  async validateKeyProvider(rawInput: Record<string, any>) {
    let parsed = importKeyInputSchema.validate(rawInput);
    if (!parsed.success)
      throw new KeyProviderAdapterError('invalid_key_input', 'Invalid AWS KMS key input');

    let input = parsed.value;
    let region = input.region ?? env.kms.KMS_AWS_REGION;
    if (!input.keyId) throw new KeyProviderAdapterError('kms_key_missing', 'KMS key is missing');
    if (!region) throw new KeyProviderAdapterError('kms_region_missing', 'KMS region is missing');

    try {
      return {
        name: `AWS KMS KeyProvider (${input.keyId})`,
        keyInfo: await this.describeKeyId({ keyId: input.keyId, region })
      };
    } catch (err) {
      throw normalizeAdapterError(err);
    }
  }

  async getSetupInfo(input: KeyProviderSetupInfoInput) {
    let region = input.region ?? env.kms.KMS_AWS_REGION ?? '<aws-region>';
    let keyId = input.keyId ?? '<kms-key-arn-or-alias>';
    let roleArn = input.roleArn ?? env.kms.KMS_EXTERNAL_KEY_ROLE_ARN ?? '<metorial-role-arn>';
    let policyStatement = {
      Sid: 'AllowMetorialUseOfConsumerKey',
      Effect: 'Allow',
      Principal: {
        AWS: roleArn
      },
      Action: ['kms:DescribeKey', 'kms:GenerateDataKey', 'kms:Decrypt'],
      Resource: '*'
    };
    let policyJson = JSON.stringify(policyStatement, null, 2);
    let importKeyProviderPayload = {
      tenantId: input.tenantId,
      keyInput: {
        keyId,
        region
      }
    };
    let optionalTags = {
      'metorial-system': 'metorial',
      'metorial-tenant-id': input.tenantId
    };

    let steps = [
      {
        title: 'Create or choose a symmetric KMS key',
        description: `Choose a symmetric ENCRYPT_DECRYPT KMS key in ${region}. It can be in your AWS account or any account that can grant Metorial access.`
      },
      {
        title: 'Grant the Metorial role access to the key',
        description: `Allow Metorial's AWS role to describe the key, generate data keys, and decrypt wrapped data keys.`,
        markdown: detag`
          Add this statement to the KMS key policy, or create an equivalent KMS grant:

          \`\`\`json
          ${policyJson}
          \`\`\`
        `
      },
      {
        title: 'Create the key provider',
        description:
          'Create the key provider after the key policy is updated. Metorial validates KMS access before storing it.',
        markdown: detag`
          Call \`keyProvider.import\` with this payload:

          \`\`\`json
          ${JSON.stringify(importKeyProviderPayload, null, 2)}
          \`\`\`
        `,
        inputs: [
          {
            type: 'text' as const,
            key: 'keyId',
            label: 'KMS key ARN, key ID, or alias',
            description: 'The customer-managed KMS key identifier that Metorial should use.'
          },
          {
            type: 'text' as const,
            key: 'region',
            label: 'AWS region',
            description: 'The AWS region where the KMS key exists.'
          }
        ]
      },
      {
        title: 'Optional: tag the customer key',
        description:
          'Tags are optional for customer-managed keys, but they help with inventory and cost allocation.',
        markdown: detag`
          Suggested optional tags:

          \`\`\`json
          ${JSON.stringify(optionalTags, null, 2)}
          \`\`\`
        `
      }
    ];

    return { steps };
  }

  async createTenantManagedKeyProvider(input: {
    tenantId: string;
    tenantIdentifier: string;
    name: string;
    systemIdentifier: string;
  }) {
    let region = env.kms.KMS_AWS_REGION;
    if (!region) throw new KeyProviderAdapterError('kms_region_missing', 'KMS region is missing');

    try {
      let created = await getKmsClient(region).send(
        new CreateKeyCommand({
          Description: `Metorial tenant data-key KMS key for ${input.tenantIdentifier}`,
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
      if (!keyId) throw new KeyProviderAdapterError('kms_key_missing', 'KMS key is missing');

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

  async generateDataKey(
    keyProvider: KeyProvider,
    context: DataKeyContext
  ): Promise<DataKeyResult> {
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
        throw new KeyProviderAdapterError('kms_data_key_missing', 'KMS did not return a data key');
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
      throw new KeyProviderAdapterError('invalid_key_info', 'Invalid AWS KMS key info');
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
        throw new KeyProviderAdapterError('kms_plaintext_missing', 'KMS did not return plaintext');
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
