import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AwsKmsKeyProviderAdapter } from './index';

let aws = vi.hoisted(() => ({
  kmsClient: vi.fn(),
  send: vi.fn()
}));

vi.mock('@aws-sdk/client-kms', () => ({
  KMSClient: class {
    constructor(input: any) {
      aws.kmsClient(input);
    }

    send = aws.send;
  },
  CreateKeyCommand: class {
    constructor(readonly input: any) {}
  },
  DecryptCommand: class {
    constructor(readonly input: any) {}
  },
  DescribeKeyCommand: class {
    constructor(readonly input: any) {}
  },
  GenerateDataKeyCommand: class {
    constructor(readonly input: any) {}
  }
}));

describe('AwsKmsKeyProviderAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aws.send.mockResolvedValue({
      KeyMetadata: {
        KeyId: 'customer-key-id',
        Arn: 'arn:aws:kms:us-west-2:999999999999:key/customer-key-id',
        AWSAccountId: '999999999999'
      }
    });
  });

  it('requires imported KMS keys to be full key ARNs', async () => {
    let adapter = new AwsKmsKeyProviderAdapter();

    await expect(adapter.validateKeyProvider({ keyId: 'alias/customer-key' })).rejects.toMatchObject({
      code: 'kms_key_arn_required'
    });
  });

  it('rejects keys from the Metorial AWS account', async () => {
    let adapter = new AwsKmsKeyProviderAdapter();

    await expect(
      adapter.validateKeyProvider({
        keyId: 'arn:aws:kms:us-east-1:123456789012:key/metorial-key-id'
      })
    ).rejects.toMatchObject({
      code: 'kms_key_account_invalid'
    });
  });

  it('accepts full key ARNs from customer AWS accounts', async () => {
    let adapter = new AwsKmsKeyProviderAdapter();
    let keyArn = 'arn:aws:kms:us-west-2:999999999999:key/customer-key-id';

    let provider = await adapter.validateKeyProvider({ keyId: keyArn });

    expect(aws.kmsClient).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'us-west-2'
      })
    );
    expect(provider.keyInfo).toMatchObject({
      keyId: 'customer-key-id',
      keyArn,
      accountId: '999999999999'
    });
  });
});
