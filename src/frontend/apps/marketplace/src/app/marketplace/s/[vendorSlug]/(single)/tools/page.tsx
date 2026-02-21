'use server';

import { notFound } from 'next/navigation';
import { providerFetch } from '../../../../../../state/sdk';
import { getProvider, getProviderCapabilities } from '../../../../../../state/provider';
import { NoTools } from '../../[serverSlug]/tools/noTools';
import { Tools } from '../../[serverSlug]/tools/tools';

export default async ({
  params: paramsPromise
}: {
  params: Promise<{ vendorSlug: string }>;
}) => {
  let params = await paramsPromise;
  let providerRes = await providerFetch(() => getProvider([params.vendorSlug]));
  if (!providerRes.success) {
    if (providerRes.error.status === 404) return notFound();
    throw providerRes.error.error;
  }

  let providerListing = providerRes.data;

  let capabilities = await providerFetch(() => getProviderCapabilities([params.vendorSlug]));

  if (!capabilities.data?.tools?.length) return <NoTools providerListing={providerListing} />;

  return <Tools providerListing={providerListing} capabilities={capabilities.data} />;
};
