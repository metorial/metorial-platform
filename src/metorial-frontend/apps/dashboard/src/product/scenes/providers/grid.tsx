import type { DashboardInstanceProviderListingsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderListings } from '@metorial/state';
import { Avatar, Badge, Text } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { RiCheckLine } from '@remixicon/react';
import styled from 'styled-components';

type ProvidersGridMode = 'default' | 'home';

type ProvidersGridProps = DashboardInstanceProviderListingsListQuery & {
  mode?: ProvidersGridMode;
};

export let ProvidersGrid = ({ mode = 'default', ...filter }: ProvidersGridProps) => {
  let instance = useCurrentInstance();
  let providers = useProviderListings(instance.data?.id, filter);
  let isHome = mode === 'home';

  return renderWithPagination(providers)(providers => (
    <>
      {providers.data.items.length > 0 && (
        <ItemGrid.Root
          columns={isHome ? 3 : undefined}
          responsive={isHome}
          width={isHome ? '220px' : '300px'}
        >
          {providers.data.items.map(listing => {
            let providerSlug = listing.provider?.slug;
            if (!providerSlug) return null;

            let description = listing.description
              ? listing.description.slice(0, 100) +
                (listing.description.length > 100 ? '...' : '')
              : '';

            let href = Paths.instance.provider(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              providerSlug
            );

            return (
              <ItemGrid.Item
                key={listing.id}
                href={href}
                entity={{ id: listing.id, hasUsage: true }}
                title={listing.name}
                description={isHome ? undefined : description}
                variant="v2"
                height={isHome ? 118 : 250}
                mode={isHome ? 'compactHorizontal' : 'default'}
                showCopyId={!isHome}
                icon={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar
                      entity={{
                        name: listing.name,
                        photoUrl: listing.imageUrl
                      }}
                      size={isHome ? 24 : 30}
                      radius={isHome ? 6 : 5}
                      imageFit="contain"
                    />

                    {!isHome && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {listing.attributes.isVerified && (
                          <Badge size="1" color="blue">
                            <RiCheckLine size={12} style={{ marginRight: 3 }} /> Verified
                          </Badge>
                        )}

                        {listing.attributes.isOfficial && (
                          <Badge size="1" color="gray">
                            Official
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                }
                bottom={
                  listing.provider?.slug ? <Text size="1">{listing.provider.slug}</Text> : undefined
                }
              />
            );
          })}
        </ItemGrid.Root>
      )}

      {providers.data.items.length == 0 && (
        <Text size="2" color="gray600">
          No providers found
        </Text>
      )}
    </>
  ));
};
