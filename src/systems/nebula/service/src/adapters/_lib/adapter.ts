import type { KeyProvider } from '../../../prisma/generated/client';

export type AdapterKeyProviderInput =
  | {
      type: 'aws_kms';
      keyId?: string;
      region?: string;
    }
  | {
      type: 'local';
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

export type KeyProviderSetupInfoInput = {
  tenantId: string;
  tenantIdentifier: string;
  region?: string;
  keyId?: string;
  roleArn?: string;
};

export type KeyProviderSetupInfo = {
  steps: {
    title: string;
    description: string;
    markdown?: string;
    inputs?: {
      type: 'text' | 'json';
      key: string;
      label: string;
      description: string;
    }[];
  }[];
};

export let detag = (strings: TemplateStringsArray, ...values: any[]) => {
  let raw = strings.reduce((out, str, idx) => `${out}${str}${values[idx] ?? ''}`, '');
  let lines = raw.replace(/^\n/, '').replace(/\n\s*$/, '').split('\n');
  let indents = lines
    .filter(line => line.trim().length > 0)
    .map(line => line.match(/^\s*/)?.[0].length ?? 0);
  let indent = indents.length ? Math.min(...indents) : 0;

  return lines.map(line => line.slice(indent)).join('\n');
};

export abstract class KeyProviderAdapter {
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
  }): Promise<{
    name: string;
    keyInfo: any;
  }>;

  abstract validateKeyProvider(input: Record<string, any>): Promise<{
    name: string;
    keyInfo: any;
  }>;

  abstract getSetupInfo(input: KeyProviderSetupInfoInput): Promise<KeyProviderSetupInfo>;

  abstract generateDataKey(keyProvider: KeyProvider, context: DataKeyContext): Promise<DataKeyResult>;

  abstract decryptDataKey(
    keyProvider: KeyProvider,
    encryptedDataKey: Uint8Array,
    keyInfo: any,
    context: DataKeyContext
  ): Promise<Uint8Array>;

  abstract describeKeyProvider(keyProvider: KeyProvider): Promise<Record<string, any>>;
}
