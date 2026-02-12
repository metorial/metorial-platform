import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import type { DashboardInstanceProviderListingsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { useCurrentInstance, useProviderListings } from '@metorial/state';
import { Avatar, Badge, Text } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { RiCheckLine } from '@remixicon/react';
import { useNavigate } from 'react-router-dom';
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

export let ServersGrid = (filter: DashboardInstanceProviderListingsListQuery) => {
  let instance = useCurrentInstance();
  let providers = useProviderListings(filter);
  let navigate = useNavigate();

  return renderWithLoader({ providers })(({ providers }) => (
    <>
      {providers.data.items.length > 0 && (
        <ItemGrid.Root width="300px">
          {providers.data.items.map(provider => (
            <ItemGrid.Item
              key={provider.id}
              entity={{ id: provider.id, hasUsage: true }}
              title={provider.name}
              description={
                provider.description
                  ? provider.description.slice(0, 100) +
                    (provider.description.length > 100 ? '...' : '')
                  : ''
              }
              height={250}
              icon={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar
                    entity={{
                      name: provider.name,
                      photoUrl: provider.imageUrl || undefined
                    }}
                    size={30}
                    radius={5}
                    withInitials
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {provider.flags.isVerified && (
                      <Badge size="1" color="blue">
                        <RiCheckLine size={12} style={{ marginRight: 3 }} /> Verified
                      </Badge>
                    )}

                    {(provider.flags.isMetorial || provider.flags.isOfficial) && (
                      <Badge size="1" color="gray">
                        Official
                      </Badge>
                    )}
                  </div>
                </div>
              }
              onClick={() =>
                navigate(
                  Paths.instance.provider(
                    instance.data?.organization,
                    instance.data?.project,
                    instance.data,
                    provider.providerId ?? undefined
                  )
                )
              }
              bottom={
                <Categories>
                  {provider.categories.map(category => (
                    <Category key={category.id}>{category.name}</Category>
                  ))}
                </Categories>
              }
            />
          ))}
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
