'use server';

import { notFound } from 'next/navigation';
import { providerFetch } from '../../../../../../state/sdk';
import { getProvider, listProviderVersions } from '../../../../../../state/provider';
import { VersionsPageClient } from '../../[serverSlug]/versions/client';

export default async ({
  params: paramsPromise,
  searchParams: searchParamsPromise
}: {
  params: Promise<{ vendorSlug: string }>;
  searchParams: Promise<{ after?: string; before?: string }>;
}) => {
  let params = await paramsPromise;
  let searchParams = await searchParamsPromise;

  let [providerListingRes, versionsRes] = await Promise.all([
    providerFetch(() => getProvider([params.vendorSlug])),
    providerFetch(() =>
      listProviderVersions([params.vendorSlug], {
        limit: '50',
        after: searchParams.after,
        before: searchParams.before
      })
    )
  ]);
  if (!providerListingRes.success) {
    if (providerListingRes.error.status === 404) return notFound();
    throw providerListingRes.error.error;
  }
  if (!versionsRes.success) {
    if (versionsRes.error.status === 404) return notFound();
    throw versionsRes.error.error;
  }

  let providerListing = providerListingRes.data;
  let versions = versionsRes.data.items;

  return (
    <>
      <VersionsPageClient
        providerListing={providerListing}
        versions={versions}
        pagination={{
          hasMoreAfter: versionsRes.data.pagination.has_more_after,
          hasMoreBefore: versionsRes.data.pagination.has_more_before
        }}
      />
    </>
  );
};
