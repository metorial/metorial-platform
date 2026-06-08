import type { KeyProvider } from '../../prisma/generated/client';
import { AwsKmsKeyProviderAdapter } from './aws-kms';
import type { KeyProviderAdapter } from './_lib/adapter';
import { LocalKeyProviderAdapter } from './local';

let adapters: Record<KeyProvider['type'], KeyProviderAdapter> = {
  aws_kms: new AwsKmsKeyProviderAdapter(),
  local: new LocalKeyProviderAdapter()
};

export let getKeyProviderAdapter = (type: KeyProvider['type']) => adapters[type];
