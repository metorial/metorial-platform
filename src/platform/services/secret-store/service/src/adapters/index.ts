import type { KeyProvider } from '../../prisma/generated/client';
import { AwsKmsKeyProviderAdapter } from './aws-kms';
import { AzureKeyVaultKeyProviderAdapter } from './azure-key-vault';
import { GcpKmsKeyProviderAdapter } from './gcp-kms';
import { LocalKeyProviderAdapter } from './local';
import type { KeyProviderAdapter } from './_lib/adapter';

let adapters: Record<KeyProvider['type'], KeyProviderAdapter> = {
  aws_kms: new AwsKmsKeyProviderAdapter(),
  gcp_kms: new GcpKmsKeyProviderAdapter(),
  azure_key_vault: new AzureKeyVaultKeyProviderAdapter(),
  local: new LocalKeyProviderAdapter()
};

export let getKeyProviderAdapter = (type: KeyProvider['type']) => adapters[type];
