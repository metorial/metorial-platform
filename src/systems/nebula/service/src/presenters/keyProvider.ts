import { Hash } from '@lowerdeck/hash';
import type { KeyProvider } from '../../prisma/generated/client';

let isMetorialManaged = (keyProvider: KeyProvider) =>
  keyProvider.isMetorialManaged || (keyProvider.keyInfo as any)?.managedByNebula === true;

let metorialManagedKeyId = async (keyProvider: KeyProvider, info: any) => {
  let hash = (await Hash.sha256(info.keyId ?? keyProvider.id)).slice(0, 20);
  return `AWS KMS (via Metorial, ref: ${hash})`;
};

let safeKeyInfo = async (keyProvider: KeyProvider) => {
  let info = keyProvider.keyInfo as any;

  if (keyProvider.type === 'aws_kms') {
    let safeKeyId = isMetorialManaged(keyProvider)
      ? await metorialManagedKeyId(keyProvider, info)
      : null;

    return {
      region: info.region,
      keyId: safeKeyId ?? info.keyId,
      keyArn: safeKeyId ?? info.keyArn,
      accountId: safeKeyId ? null : info.accountId
    };
  }

  return {
    variant: info.variant,
    version: info.version
  };
};

export let keyProviderPresenter = async (keyProvider: KeyProvider) => ({
  object: 'nebula#key_provider',
  id: keyProvider.id,
  name: keyProvider.name,
  type: keyProvider.type,
  owner: keyProvider.owner,
  status: keyProvider.status,
  isMetorialManaged: isMetorialManaged(keyProvider),
  keyReuseTimeSeconds: keyProvider.keyReuseTimeSeconds,
  keyInfo: await safeKeyInfo(keyProvider),
  createdAt: keyProvider.createdAt,
  updatedAt: keyProvider.updatedAt
});
