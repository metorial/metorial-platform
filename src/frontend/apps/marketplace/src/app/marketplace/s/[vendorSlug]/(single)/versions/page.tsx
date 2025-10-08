'use server';

import { notFound } from 'next/navigation';
import { serverFetch } from '../../../../../../state/sdk';
import { getServer, listServerVersions } from '../../../../../../state/server';
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

  let [serverRes, versionsRes] = await Promise.all([
    serverFetch(() => getServer([params.vendorSlug])),
    serverFetch(() =>
      listServerVersions([params.vendorSlug], {
        limit: '50',
        after: searchParams.after,
        before: searchParams.before
      })
    )
  ]);
  if (!serverRes.success) {
    if (serverRes.error.status === 404) return notFound();
    throw serverRes.error.error;
  }
  if (!versionsRes.success) {
    if (versionsRes.error.status === 404) return notFound();
    throw versionsRes.error.error;
  }

  let server = serverRes.data;
  let versions = versionsRes.data.items;

  return (
    <>
      <VersionsPageClient
        server={server}
        versions={versions}
        pagination={{
          hasMoreAfter: versionsRes.data.pagination.has_more_after,
          hasMoreBefore: versionsRes.data.pagination.has_more_before
        }}
      />
    </>
  );
};
