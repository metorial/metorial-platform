'use client';

import { useIsMobile } from '@looped/hooks';
import { useUser } from '@metorial/state';
import { ServerListing } from '../../../../../../state/server';
import { LocalHeader } from '../../../../components/localHeader';
import { useExplorer } from './explorer/context';

export let ServerHeader = ({ server }: { server: ServerListing }) => {
  let basePath = `/s/${server.slug}`;
  let explorer = useExplorer(server);
  let isMobile = useIsMobile(700);

  let user = useUser();

  return (
    <LocalHeader
      headerImageHash={server.id}
      basePath={basePath}
      extra={
        <>
          <span>{server.vendor?.name ?? 'Unknown'}</span>/
          <span>{server.repository?.name ?? server.slug}</span>
        </>
      }
      title={server.name}
      items={[
        { label: 'Overview', href: '' },
        { label: 'Tools', href: `/tools` },
        ...(isMobile ? [] : [{ label: 'Explore', onClick: () => explorer.open() }]),
        { label: 'Versions', href: `/versions` },
        ...(user.data ? [{ label: 'Deployments', href: `/deployments` }] : [])
        // { label: 'Usage', href: `/usage` }
      ]}
    />
  );
};
