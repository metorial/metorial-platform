'use server';

import { Button } from '@metorial/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverFetch } from '../../../../../../state/sdk';
import { getServer, listServerVersions } from '../../../../../../state/server';
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

  let [serverRes, versionsRes] = await Promise.all([
    serverFetch(() => getServer(params.vendorSlug, params.serverSlug)),
    serverFetch(() =>
      listServerVersions(params.vendorSlug, params.serverSlug, {
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
      <VersionsPageClient server={server} versions={versions} />

      <div
        style={{
          display: 'flex',
          gap: 15,
          justifyContent: 'flex-end',
          marginTop: 15
        }}
      >
        {versionsRes.data.pagination.has_more_before && (
          <Link
            href={`/s/${params.vendorSlug}/${params.serverSlug}/versions?before=${versions[0]?.id}`}
          >
            <Button variant="outline" as="span" size="1">
              Previous
            </Button>
          </Link>
        )}
        {versionsRes.data.pagination.has_more_before && (
          <Link
            href={`/s/${params.vendorSlug}/${params.serverSlug}/versions?after=${versions[versions.length - 1]?.id}`}
          >
            <Button variant="outline" as="span" size="1">
              Next
            </Button>
          </Link>
        )}
      </div>
    </>
  );
};
