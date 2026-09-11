import {
  type CustomProviderVersion,
  type Provider,
  type ProviderVersion,
  withTransaction
} from '@metorial-subspace/db';

export let linkNewShuttleVersionToCustomProvider = async ({
  customProviderVersion,
  provider,
  providerVersion
}: {
  customProviderVersion: CustomProviderVersion;
  provider: Provider;
  providerVersion: ProviderVersion;
}) =>
  withTransaction(async db => {
    await db.customProviderVersion.updateMany({
      where: { oid: customProviderVersion.oid },
      data: {
        status: 'deployment_succeeded',
        providerVersionOid: providerVersion.oid
      }
    });
    await db.customProvider.updateMany({
      where: { oid: customProviderVersion.customProviderOid },
      data: {
        providerOid: provider.oid,
        providerVariantOid: provider.defaultVariantOid
      }
    });

    await db.provider.updateMany({
      where: { oid: provider.oid },
      data: {
        access: 'tenant',
        ownerTenantOid: customProviderVersion.tenantOid,
        ownerSolutionOid: customProviderVersion.solutionOid
      }
    });
  });
