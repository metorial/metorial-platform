'use server';

import { notFound } from 'next/navigation';
import { serverFetch } from '../../../../../state/sdk';
import { getServer, getServerCapabilities } from '../../../../../state/server';
import { NoTools } from '../../[vendorSlug]/[serverSlug]/tools/noTools';
import { Tools } from '../../[vendorSlug]/[serverSlug]/tools/tools';

export default async ({
  params: paramsPromise
}: {
  params: Promise<{ serverSlug: string }>;
}) => {
  let params = await paramsPromise;
  let serverRes = await serverFetch(() => getServer([params.serverSlug]));
  if (!serverRes.success) {
    if (serverRes.error.status === 404) return notFound();
    throw serverRes.error.error;
  }

  let server = serverRes.data;

  let capabilities = await serverFetch(() => getServerCapabilities([params.serverSlug]));

  if (!capabilities.data?.tools?.length) return <NoTools server={server} />;

  return <Tools server={server} capabilities={capabilities.data} />;
};
