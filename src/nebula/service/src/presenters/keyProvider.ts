import { Hash } from '@lowerdeck/hash';
import type { KeyProvider } from '../../prisma/generated/client';

let isMetorialManaged = (keyProvider: KeyProvider) =>
  keyProvider.owner === 'system' ||
  keyProvider.isMetorialManaged ||
  (keyProvider.keyInfo as any)?.managedByNebula === true;

let providerLabels: Record<string, string> = {
  aws_kms: 'AWS KMS',
  gcp_kms: 'GCP KMS',
  azure_key_vault: 'Azure Key Vault'
};

let metorialManagedKeyId = async (keyProvider: KeyProvider, info: any) => {
  let hash = (
    await Hash.sha256(info.keyId ?? info.keyName ?? info.vaultUrl ?? keyProvider.id)
  ).slice(0, 20);
  return `${providerLabels[keyProvider.type] ?? keyProvider.type} (via Metorial, ref: ${hash})`;
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

  if (keyProvider.type === 'gcp_kms') {
    let safeKeyName = isMetorialManaged(keyProvider)
      ? await metorialManagedKeyId(keyProvider, info)
      : null;

    return {
      keyName: safeKeyName ?? info.keyName,
      projectId: safeKeyName ? null : info.projectId,
      location: safeKeyName ? null : info.location
    };
  }

  if (keyProvider.type === 'azure_key_vault') {
    let safeKeyName = isMetorialManaged(keyProvider)
      ? await metorialManagedKeyId(keyProvider, info)
      : null;

    return {
      keyName: safeKeyName ?? info.keyName,
      vaultUrl: safeKeyName ? null : info.vaultUrl,
      algorithm: info.algorithm
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
  isGlobal: keyProvider.tenantOid === null,
  keyReuseTimeSeconds: keyProvider.keyReuseTimeSeconds,
  keyInfo: await safeKeyInfo(keyProvider),
  createdAt: keyProvider.createdAt,
  updatedAt: keyProvider.updatedAt
});
