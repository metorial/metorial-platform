'use client';

import { ProviderListing } from '../../../../../../state/provider';
import { LocalHeader } from '../../../../components/localHeader';

export let ProviderHeader = ({ providerListing }: { providerListing: ProviderListing }) => {
  let basePath = `/marketplace/s/${providerListing.slug}`;
  let items: { label: string; href?: string; onClick?: () => void }[] = [
    { label: 'Overview', href: '' },
    { label: 'Versions', href: `/versions` }
  ];

  if (providerListing.isHostable) {
    items.push(
      {
        label: 'Deploy',
        onClick: () => {
          let url = `${process.env.DASHBOARD_FRONTEND_URL}/welcome/jumpstart?path=${encodeURIComponent(`/deploy?provider_id=${providerListing.providerId}`)}`;
          window.open(url, '_blank');
        }
      },
      {
        label: 'Explore',
        onClick: () => {
          let url = `${process.env.DASHBOARD_FRONTEND_URL}/welcome/jumpstart?path=${encodeURIComponent(`/explorer?provider_id=${providerListing.providerId}`)}`;
          window.open(url, '_blank');
        }
      }
    );
  }

  return (
    <LocalHeader
      headerImageHash={providerListing.id}
      basePath={basePath}
      extra={
        <>
          {!providerListing.isOfficial && providerListing.vendor && <span>{providerListing.vendor.name}</span>}
          <span>{providerListing.slug}</span>
        </>
      }
      title={providerListing.name}
      items={items}
    />
  );
};
