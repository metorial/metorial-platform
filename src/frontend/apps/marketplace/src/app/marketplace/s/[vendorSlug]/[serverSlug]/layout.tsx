'use server';

import { notFound } from 'next/navigation';
import { serverFetch } from '../../../../../state/sdk';
import { getServer } from '../../../../../state/server';
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
  let serverRes = await serverFetch(() => getServer(params.vendorSlug, params.serverSlug));
  if (!serverRes.success) {
    if (serverRes.error.status === 404) return notFound();
    throw serverRes.error.error;
  }

  let server = serverRes.data;

  return (
    <FullPage>
      <ClientLayout server={server}>{children}</ClientLayout>
    </FullPage>
  );
};
