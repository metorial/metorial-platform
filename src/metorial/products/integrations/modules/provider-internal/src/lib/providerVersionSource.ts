import type { Provider, ProviderDeploymentVersion } from '@metorial-subspace/db';

export type ProviderVersionSource =
  | { type: 'none' }
  | { type: 'locked'; lockedVersionOid: bigint }
  | { type: 'environment' }
  | { type: 'default_variant' };

export let getProviderVersionSource = (d: {
  provider: Pick<Provider, 'defaultVariantOid' | 'hasEnvironments'>;
  deployment?: {
    currentVersion: Pick<ProviderDeploymentVersion, 'lockedVersionOid'> | null;
  } | null;
}): ProviderVersionSource => {
  if (!d.provider.defaultVariantOid) return { type: 'none' };

  let lockedVersionOid = d.deployment?.currentVersion?.lockedVersionOid;
  if (lockedVersionOid) return { type: 'locked', lockedVersionOid };

  if (d.provider.hasEnvironments) return { type: 'environment' };

  return { type: 'default_variant' };
};
