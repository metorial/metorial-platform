'use server';

import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import { serverFetch } from '../../../../../state/sdk';
import { getServer } from '../../../../../state/server';
import { ServerReadme } from './components/readme';
import { Skills } from './components/skills';

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

  return (
    <>
      <Skills skills={server.skills} />

      {server.readme && (
        <ServerReadme
          readme={server.readme}
          imageRoot={
            server.repository
              ? `https://raw.githubusercontent.com/${server.repository.identifier.replace('github.com/', '')}/${server.repository.defaultBranch ?? 'main'}`
              : 'https://metorial.com'
          }
          linkRoot={
            server.repository
              ? `https://github.com/${server.repository.identifier.replace('github.com/', '')}/blob/${server.repository.defaultBranch ?? 'main'}`
              : 'https://metorial.com'
          }
          rootPath={server.subdirectory ?? undefined}
        />
      )}
    </>
  );
};

export async function generateMetadata(
  { params: paramsPromise }: { params: Promise<{ vendorSlug: string; serverSlug: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  let params = await paramsPromise;
  let serverRes = await serverFetch(() => getServer(params.vendorSlug, params.serverSlug));

  return {
    title: `${serverRes.data?.name ?? 'Not Found'} • Metorial Index`,
    description: 'The open source integration platform for agentic AI.',
    metadataBase: new URL('https://metorial.com'),
    alternates: { canonical: '/' },
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
      site: '@metorial_ai',
      title: 'Metorial',
      description: 'The open source integration platform for agentic AI.',
      images: { url: '/twitter-image.jpg', alt: 'Metorial' }
    }
  };
}
