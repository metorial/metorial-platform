import {
  CreateKeyCommand,
  DecryptCommand,
  DescribeKeyCommand,
  GenerateDataKeyCommand,
  KMSClient
} from '@aws-sdk/client-kms';
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import { v } from '@lowerdeck/validation';
import type { KeyProvider } from '../../../prisma/generated/client';
import { env } from '../../env';
import type {
  DataKeyContext,
  DataKeyResult,
  KeyProviderSetupInfoInput
} from '../_lib/adapter';
import { KeyProviderAdapter } from '../_lib/adapter';
import { KeyProviderAdapterError, normalizeAdapterError } from '../_lib/errors';

let importKeyInputSchema = v.object({
  keyId: v.string(),
  region: v.optional(v.string())
});

let kmsKeyArnRegex = /^arn:([^:]+):kms:([^:]+):(\d{12}):key\/(.+)$/;
let iamArnRegex = /^arn:([^:]+):iam::(\d{12}):.+$/;

let kmsClientCache = new Map<string, KMSClient>();

let parseKmsKeyArn = (keyArn: string) => {
  let match = keyArn.match(kmsKeyArnRegex);
  if (!match) {
    throw new KeyProviderAdapterError(
      'kms_key_arn_required',
      'KMS key must be provided as a full key ARN'
    );
  }

  return {
    partition: match[1]!,
    region: match[2]!,
    accountId: match[3]!,
    keyId: match[4]!
  };
};

let getServiceAccountId = () => {
  let roleArn = env.kms.KMS_EXTERNAL_KEY_ROLE_ARN;
  let accountId = roleArn?.match(iamArnRegex)?.[2];
  if (!accountId) {
    throw new KeyProviderAdapterError(
      'kms_service_account_missing',
      'Metorial KMS role ARN is missing'
    );
  }

  return accountId;
};

let shouldUseExternalRole = (d: {
  keyProvider?: KeyProvider;
  keyInfo?: { accountId?: string };
}) => {
  if (!env.kms.KMS_EXTERNAL_KEY_ROLE_ARN) return false;
  if (d.keyProvider?.isMetorialManaged) return false;
  if (d.keyProvider?.owner === 'system') return false;

  let serviceAccountId = getServiceAccountId();
  let accountId = d.keyInfo?.accountId ?? (d.keyProvider?.keyInfo as any)?.accountId;
  return !!accountId && accountId !== serviceAccountId;
};

let getKmsClient = (region?: string, opts?: { assumeExternalRole?: boolean }) => {
  let resolvedRegion = region ?? env.kms.KMS_AWS_REGION;
  let assumeExternalRole = opts?.assumeExternalRole ?? false;
  let cacheKey = `${resolvedRegion}:${assumeExternalRole ? 'external' : 'task'}`;

  let cached = kmsClientCache.get(cacheKey);
  if (cached) return cached;

  let client = new KMSClient({
    region: resolvedRegion,
    credentials:
      assumeExternalRole && env.kms.KMS_EXTERNAL_KEY_ROLE_ARN
        ? fromTemporaryCredentials({
            params: {
              RoleArn: env.kms.KMS_EXTERNAL_KEY_ROLE_ARN,
              RoleSessionName: 'metorial-secret-store-kms'
            }
          })
        : env.kms.KMS_AWS_ACCESS_KEY_ID && env.kms.KMS_AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.kms.KMS_AWS_ACCESS_KEY_ID,
              secretAccessKey: env.kms.KMS_AWS_SECRET_ACCESS_KEY
            }
          : undefined
  });
  kmsClientCache.set(cacheKey, client);

  return client;
};

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
    if (!region)
      throw new KeyProviderAdapterError('kms_region_missing', 'KMS region is missing');

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
        throw new KeyProviderAdapterError(
          'kms_default_key_missing',
          'Default KMS key is missing'
        );
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
    let keyArn = parseKmsKeyArn(input.keyId);
    let serviceAccountId = getServiceAccountId();
    let region = keyArn.region;

    if (!input.keyId)
      throw new KeyProviderAdapterError('kms_key_missing', 'KMS key is missing');
    if (keyArn.accountId === serviceAccountId) {
      throw new KeyProviderAdapterError(
        'kms_key_account_invalid',
        'KMS key must be owned by a customer AWS account'
      );
    }

    try {
      return {
        name: `AWS KMS Key (${keyArn.keyId})`,
        keyInfo: {
          ...(await this.describeKeyId({
            keyId: input.keyId,
            region,
            assumeExternalRole: true
          })),
          ts: Date.now()
        }
      };
    } catch (err) {
      throw normalizeAdapterError(err);
    }
  }

  async getSetupInfo(input: KeyProviderSetupInfoInput) {
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

    let steps = [
      {
        title: 'Create or choose a symmetric KMS key',
        description: `Choose a symmetric ENCRYPT_DECRYPT KMS key.`
      },
      {
        title: 'Grant the Metorial role access to the key',
        description: `Grant Metorial access to the key by adding the following statement to the key policy.`,
        markdown: `
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
        inputs: [
          {
            type: 'text' as const,
            key: 'keyId',
            label: 'KMS Key ARN',
            description:
              'The full ARN of the customer-managed KMS key that Metorial should use.'
          }
        ]
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
    if (!region)
      throw new KeyProviderAdapterError('kms_region_missing', 'KMS region is missing');

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
    let assumeExternalRole = shouldUseExternalRole({ keyProvider, keyInfo });

    try {
      let result = await getKmsClient(keyInfo.region, { assumeExternalRole }).send(
        new GenerateDataKeyCommand({
          KeyId: keyInfo.keyArn ?? keyInfo.keyId,
          KeySpec: 'AES_256',
          EncryptionContext: getEncryptionContext(context)
        })
      );

      if (!result.Plaintext || !result.CiphertextBlob) {
        throw new KeyProviderAdapterError(
          'kms_data_key_missing',
          'KMS did not return a data key'
        );
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

    let assumeExternalRole = shouldUseExternalRole({ keyProvider, keyInfo });

    try {
      let result = await getKmsClient(keyInfo.region, { assumeExternalRole }).send(
        new DecryptCommand({
          KeyId: keyInfo.keyArn ?? keyInfo.keyId ?? (keyProvider.keyInfo as any).keyArn,
          CiphertextBlob: encryptedDataKey,
          EncryptionContext: getEncryptionContext(context)
        })
      );

      if (!result.Plaintext) {
        throw new KeyProviderAdapterError(
          'kms_plaintext_missing',
          'KMS did not return plaintext'
        );
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

  private async describeKeyId(d: {
    keyId: string;
    region: string;
    assumeExternalRole?: boolean;
  }) {
    let described = await getKmsClient(d.region, {
      assumeExternalRole: d.assumeExternalRole
    }).send(
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
