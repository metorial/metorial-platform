import type { KeyProvider } from '../../../prisma/generated/client';

export type AdapterKeyProviderInput =
  | {
      type: 'aws_kms';
      name: string;
      keyId?: string;
      region?: string;
    }
  | {
      type: 'local';
      name: string;
    };

export type KeyProviderCreateInput = {
  name: string;
  keyId?: string;
  region?: string;
};

export type DataKeyContext = {
  tenantId: string;
  tenantOid: bigint;
  keyProviderId: string;
  keyProviderOid: bigint;
  keyId?: string;
};

export type DataKeyResult = {
  plaintextDataKey: Uint8Array;
  encryptedDataKey: Uint8Array;
  keyInfo: any;
};

export abstract class NebulaKeyProviderAdapter {
  abstract readonly type: KeyProvider['type'];

  abstract createSystemKeyProvider(): Promise<{
    name: string;
    keyInfo: any;
  }>;

  abstract createTenantManagedKeyProvider(input: {
    tenantId: string;
    tenantIdentifier: string;
    name: string;
    systemIdentifier: string;
    region?: string;
  }): Promise<{
    name: string;
    keyInfo: any;
  }>;

  abstract validateKeyProvider(input: AdapterKeyProviderInput): Promise<{
    keyInfo: any;
  }>;

  abstract generateDataKey(keyProvider: KeyProvider, context: DataKeyContext): Promise<DataKeyResult>;

  abstract decryptDataKey(
    keyProvider: KeyProvider,
    encryptedDataKey: Uint8Array,
    keyInfo: any,
    context: DataKeyContext
  ): Promise<Uint8Array>;

  abstract describeKeyProvider(keyProvider: KeyProvider): Promise<Record<string, any>>;
}
