import {
  addAfterTransactionHook,
  type CustomProviderVersion,
  db,
  type Provider,
  type ProviderVersion,
  withTransaction
} from '@metorial-subspace/db';
import {
  enqueueProviderSpecSearchIndex,
  indexProviderListingQueue
} from '@metorial-subspace/module-provider-internal';
import { requestSecurityReview } from '@metorial-subspace/module-security-review-request';

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

    await db.providerListing.updateMany({
      where: { providerOid: provider.oid },
      data: {
        isPublic: false,
        ownerTenantOid: customProviderVersion.tenantOid,
        ownerSolutionOid: customProviderVersion.solutionOid
      }
    });

    await addAfterTransactionHook(() => reindexTenantProviderSearch(provider));
    await addAfterTransactionHook(() =>
      requestSecurityReview({ subject: 'customProviderVersion', id: customProviderVersion.id })
    );
  });

let reindexTenantProviderSearch = async (provider: Provider) => {
  await enqueueProviderSpecSearchIndex({ providerId: provider.id });

  let providerListing = await db.providerListing.findUnique({
    where: { providerOid: provider.oid },
    select: { id: true }
  });
  if (providerListing) {
    await indexProviderListingQueue.add({ providerListingId: providerListing.id });
  }
};
