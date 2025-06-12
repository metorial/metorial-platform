'use server';

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
              ? `https://raw.githubusercontent.com/${server.repository.identifier.replace('github.com/', '')}/${server.repository.defaultBranch ?? 'main'}/`
              : undefined
          }
        />
      )}
    </>
  );
};
