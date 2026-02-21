'use server';

import { notFound } from 'next/navigation';
import { providerFetch } from '../../../../../../state/sdk';
import { getProvider, listProviderVersions } from '../../../../../../state/provider';
import { VersionsPageClient } from './client';

export default async ({
  params: paramsPromise,
  searchParams: searchParamsPromise
}: {
  params: Promise<{ vendorSlug: string; serverSlug: string }>;
  searchParams: Promise<{ after?: string; before?: string }>;
}) => {
  let params = await paramsPromise;
  let searchParams = await searchParamsPromise;

  let [providerRes, versionsRes] = await Promise.all([
    providerFetch(() => getProvider([params.vendorSlug, params.serverSlug])),
    providerFetch(() =>
      listProviderVersions([params.vendorSlug, params.serverSlug], {
        limit: '50',
        after: searchParams.after,
        before: searchParams.before
      })
    )
  ]);
  if (!providerRes.success) {
    if (providerRes.error.status === 404) return notFound();
    throw providerRes.error.error;
  }
  if (!versionsRes.success) {
    if (versionsRes.error.status === 404) return notFound();
    throw versionsRes.error.error;
  }

  let providerListing = providerRes.data;
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
