'use client';

import { ServerListing } from '../../../../../../state/server';
import { LocalHeader } from '../../../../components/localHeader';

export let ServerHeader = ({ server }: { server: ServerListing }) => {
  let basePath = `/marketplace/s/${server.slug}`;
  let items: { label: string; href?: string; onClick?: () => void }[] = [
    { label: 'Overview', href: '' },
    { label: 'Versions', href: `/versions` }
  ];

  if (server.isHostable) {
    items.push(
      {
        label: 'Deploy',
        onClick: () => {
          let url = `${process.env.DASHBOARD_FRONTEND_URL}/welcome/jumpstart?path=${encodeURIComponent(`/deploy?provider_id=${server.providerId}`)}`;
          window.open(url, '_blank');
        }
      },
      {
        label: 'Explore',
        onClick: () => {
          let url = `${process.env.DASHBOARD_FRONTEND_URL}/welcome/jumpstart?path=${encodeURIComponent(`/explorer?provider_id=${server.providerId}`)}`;
          window.open(url, '_blank');
        }
      }
    );
  }

  return (
    <LocalHeader
      headerImageHash={server.id}
      basePath={basePath}
      extra={
        <>
          {!server.isOfficial && server.vendor && <span>{server.vendor.name}</span>}
          <span>{server.slug}</span>
        </>
      }
      title={server.name}
      items={items}
    />
  );
};
