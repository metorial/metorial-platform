'use server';

import { notFound } from 'next/navigation';
import { serverFetch } from '../../../../../../state/sdk';
import { getServer, getServerCapabilities } from '../../../../../../state/server';
import { NoTools } from '../../[serverSlug]/tools/noTools';
import { Tools } from '../../[serverSlug]/tools/tools';

export default async ({
  params: paramsPromise
}: {
  params: Promise<{ vendorSlug: string }>;
}) => {
  let params = await paramsPromise;
  let serverRes = await serverFetch(() => getServer([params.vendorSlug]));
  if (!serverRes.success) {
    if (serverRes.error.status === 404) return notFound();
    throw serverRes.error.error;
  }

  let server = serverRes.data;

  let capabilities = await serverFetch(() => getServerCapabilities([params.vendorSlug]));

  if (!capabilities.data?.tools?.length) return <NoTools server={server} />;

  return <Tools server={server} capabilities={capabilities.data} />;
};
