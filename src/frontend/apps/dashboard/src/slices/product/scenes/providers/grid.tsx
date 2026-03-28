import type { DashboardInstanceProviderListingsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderListings } from '@metorial/state';
import { Avatar, Badge, Text } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { RiCheckLine } from '@remixicon/react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

let Categories = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

let Category = styled.div`
  background: #f0f0f0;
  height: 26px;
  border-radius: 50px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
`;

export let ProvidersGrid = (filter: DashboardInstanceProviderListingsListQuery) => {
  let instance = useCurrentInstance();
  let providers = useProviderListings(instance.data?.id, filter);

  return renderWithPagination(providers)(providers => (
    <>
      {providers.data.items.length > 0 && (
        <ItemGrid.Root width="300px">
          {providers.data.items.map(listing => {
            let providerId = listing.provider?.id;
            if (!providerId) return null;

            let description = listing.description
              ? listing.description.slice(0, 100) +
                (listing.description.length > 100 ? '...' : '')
              : '';

            let href = Paths.instance.provider(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              providerId
            );

            return (
              <Link
                key={listing.id}
                to={href}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <ItemGrid.Item
                  entity={{ id: listing.id, hasUsage: true }}
                  title={listing.name}
                  description={description}
                  height={250}
                  icon={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar
                        entity={{
                          name: listing.name,
                          photoUrl: listing.imageUrl
                        }}
                        size={30}
                        radius={5}
                        imageFit="contain"
                      />

                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {listing.attributes.isVerified && (
                          <Badge size="1" color="blue">
                            <RiCheckLine size={12} style={{ marginRight: 3 }} /> Verified
                          </Badge>
                        )}

                        {(listing.attributes.isMetorial || listing.attributes.isOfficial) && (
                          <Badge size="1" color="gray">
                            Official
                          </Badge>
                        )}
                      </div>
                    </div>
                  }
                  bottom={
                    <Categories>
                      {listing.categories.map(category => (
                        <Category key={category.id}>{category.name}</Category>
                      ))}
                    </Categories>
                  }
                />
              </Link>
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
