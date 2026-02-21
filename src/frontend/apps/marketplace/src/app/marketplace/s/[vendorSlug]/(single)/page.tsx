'use server';

import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import { providerFetch } from '../../../../../state/sdk';
import { getProvider } from '../../../../../state/provider';
import { ServerReadme } from '../[serverSlug]/components/readme';
import { Skills } from '../[serverSlug]/components/skills';

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

  return (
    <>
      <Skills skills={providerListing.skills} />

      {providerListing.readme && (
        <ServerReadme
          readme={providerListing.readme}
          imageRoot="https://metorial.com"
          linkRoot="https://metorial.com"
        />
      )}
    </>
  );
};

export async function generateMetadata(
  { params: paramsPromise }: { params: Promise<{ vendorSlug: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  let params = await paramsPromise;
  let providerRes = await providerFetch(() => getProvider([params.vendorSlug]));

  return {
    title: `${providerRes.data?.name ?? 'Not Found'} • Metorial Marketplace`,
    description: 'The open source integration platform for agentic AI.',
    metadataBase: new URL('https://metorial.com'),
    openGraph: {
      images: { url: '/opengraph-image.jpg', alt: 'Metorial' },
      title: 'Metorial',
      siteName: 'Metorial',
      description: 'The open source integration platform for agentic AI.',
      type: 'website',
      locale: 'en_US',
      url: 'https://metorial.com'
    },
    twitter: {
      card: 'summary_large_image',
      site: '@metorialAi',
      title: 'Metorial',
      description: 'The open source integration platform for agentic AI.',
      images: { url: '/twitter-image.jpg', alt: 'Metorial' }
    }
  };
}
