import type { KeyProvider } from '../../prisma/generated/client';
import { AwsKmsKeyProviderAdapter } from './aws-kms';
import type { NebulaKeyProviderAdapter } from './_lib/adapter';
import { LocalKeyProviderAdapter } from './local';

let adapters: Record<KeyProvider['type'], NebulaKeyProviderAdapter> = {
  aws_kms: new AwsKmsKeyProviderAdapter(),
  local: new LocalKeyProviderAdapter()
};

export let getKeyProviderAdapter = (type: KeyProvider['type']) => adapters[type];
