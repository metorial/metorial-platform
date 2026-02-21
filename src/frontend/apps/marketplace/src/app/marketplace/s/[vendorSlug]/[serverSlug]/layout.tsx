'use server';

import { notFound } from 'next/navigation';
import { providerFetch } from '../../../../../state/sdk';
import { getProvider } from '../../../../../state/provider';
import { FullPage } from '../../../components/fullPage';
import { ClientLayout } from './clientLayout';

export default async ({
  params: paramsPromise,
  children
}: {
  params: Promise<{ vendorSlug: string; serverSlug: string }>;
  children: React.ReactNode;
}) => {
  let params = await paramsPromise;
  let providerRes = await providerFetch(() => getProvider([params.vendorSlug, params.serverSlug]));
  if (!providerRes.success) {
    if (providerRes.error.status === 404) return notFound();
    throw providerRes.error.error;
  }

  let providerListing = providerRes.data;

  return (
    <FullPage>
      <ClientLayout providerListing={providerListing}>{children}</ClientLayout>
    </FullPage>
  );
};
