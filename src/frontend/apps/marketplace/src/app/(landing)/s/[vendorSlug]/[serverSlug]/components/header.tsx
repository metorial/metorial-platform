'use client';

import { useIsSSR } from '@looped/hooks';
import { useUser } from '@metorial/state';
import { ServerListing } from '../../../../../../state/server';
import { LocalHeader } from '../../../../components/localHeader';

export let ServerHeader = ({ server }: { server: ServerListing }) => {
  let basePath = `/s/${server.slug}`;

  let user = useUser();
  let isServer = useIsSSR();

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
        { label: 'Versions', href: `/versions` },
        {
          label: 'Deploy',
          onClick: () => {
            let url = `${process.env.DASHBOARD_FRONTEND_URL}/welcome/jumpstart?path=${encodeURIComponent(`/deploy?server_id=${server.serverId}`)}`;
            window.open(url, '_blank');
          }
        },
        {
          label: 'Explore',
          onClick: () => {
            let url = `${process.env.DASHBOARD_FRONTEND_URL}/welcome/jumpstart?path=${encodeURIComponent(`/explorer?server_id=${server.serverId}`)}`;
            window.open(url, '_blank');
          }
        }
      ]}
    />
  );
};
