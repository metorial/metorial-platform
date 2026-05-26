import type { KeyProvider } from '../../prisma/generated/client';

let safeKeyInfo = (keyProvider: KeyProvider) => {
  let info = keyProvider.keyInfo as any;

  if (keyProvider.type === 'aws_kms') {
    return {
      region: info.region,
      keyId: info.keyId,
      keyArn: info.keyArn,
      accountId: info.accountId
    };
  }

  return {
    variant: info.variant,
    version: info.version
  };
};

let isMetorialManaged = (keyProvider: KeyProvider) =>
  keyProvider.isMetorialManaged || (keyProvider.keyInfo as any)?.managedByNebula === true;

export let keyProviderPresenter = (keyProvider: KeyProvider) => ({
  object: 'nebula#key_provider',
  id: keyProvider.id,
  name: keyProvider.name,
  type: keyProvider.type,
  owner: keyProvider.owner,
  status: keyProvider.status,
  isMetorialManaged: isMetorialManaged(keyProvider),
  keyReuseTimeSeconds: keyProvider.keyReuseTimeSeconds,
  keyInfo: safeKeyInfo(keyProvider),
  createdAt: keyProvider.createdAt,
  updatedAt: keyProvider.updatedAt
});
