'use server';

import { notFound } from 'next/navigation';
import { serverFetch } from '../../../../../../state/sdk';
import { getServer } from '../../../../../../state/server';
import { DeploymentPageClient } from './client';

export default async ({
  params: paramsPromise
}: {
  params: Promise<{ vendorSlug: string; serverSlug: string }>;
}) => {
  let params = await paramsPromise;
  let serverRes = await serverFetch(() => getServer(params.vendorSlug, params.serverSlug));
  if (!serverRes.success) {
    if (serverRes.error.status === 404) return notFound();
    throw serverRes.error.error;
  }

  let server = serverRes.data;

  return <DeploymentPageClient server={server} />;
};
