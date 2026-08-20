import { badRequestError, ServiceError } from '@lowerdeck/error';

export let assertProviderConfigPatchGeneration = (d: {
  patch?: { set?: Record<string, unknown>; remove?: string[] };
  expectedGeneration?: number;
}) => {
  if (d.expectedGeneration !== undefined && !d.patch) {
    throw new ServiceError(
      badRequestError({
        code: 'config_patch_required',
        message: 'Expected config generation can only be used with a config patch.'
      })
    );
  }
};

export let prepareProviderConfigBackingPatch = (d: {
  patch: { set?: Record<string, unknown>; remove?: string[] };
  expectedGeneration?: number;
  fromVaultOid: bigint | null;
  hasProviderVariant: boolean;
  currentVersion: {
    slateInstanceOid: bigint | null;
    shuttleConfigOid: bigint | null;
  } | null;
}) => {
  if (d.fromVaultOid) {
    throw new ServiceError(
      badRequestError({
        code: 'vault_config_patch_not_allowed',
        message: 'Vault-backed provider configs must be updated through their vault.'
      })
    );
  }
  if (!d.hasProviderVariant || !d.currentVersion) {
    throw new ServiceError(
      badRequestError({
        code: 'provider_config_backing_unavailable',
        message: 'Provider config backing is unavailable.'
      })
    );
  }
  return {
    backing: {
      slateInstanceOid: d.currentVersion.slateInstanceOid,
      shuttleConfigOid: d.currentVersion.shuttleConfigOid
    },
    patch: d.patch,
    expectedGeneration: d.expectedGeneration
  };
};
