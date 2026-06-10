import type { DashboardInstanceProviderListingsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderListings } from '@metorial/state';
import { Avatar, Badge, Text, theme } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { RiCheckLine } from '@remixicon/react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

type ProvidersGridMode = 'default' | 'home';

type ProvidersGridProps = DashboardInstanceProviderListingsListQuery & {
  mode?: ProvidersGridMode;
};

let ProviderLink = styled(Link)`
  color: inherit;
  text-decoration: none;

  &:hover > li,
  &:focus-visible > li {
    border-color: ${theme.colors.gray400};
    box-shadow: ${theme.shadows.small};
  }
`;

let Categories = styled.div.withConfig({ shouldForwardProp: p => p !== '$mode' })<{
  $mode: ProvidersGridMode;
}>`
  display: flex;
  flex-wrap: wrap;
  gap: ${p => (p.$mode === 'home' ? '4px' : '10px')};
  ${p =>
    p.$mode === 'home'
      ? `
    max-height: 40px;
    overflow: hidden;
  `
      : ''}
`;

let Category = styled.div.withConfig({ shouldForwardProp: p => p !== '$mode' })<{
  $mode: ProvidersGridMode;
}>`
  background: #f0f0f0;
  height: ${p => (p.$mode === 'home' ? '18px' : '26px')};
  border-radius: 50px;
  padding: 0 ${p => (p.$mode === 'home' ? '6px' : '10px')};
  display: flex;
  align-items: center;
  font-size: ${p => (p.$mode === 'home' ? '10px' : '12px')};
  font-weight: 500;
`;

export let ProvidersGrid = ({ mode = 'default', ...filter }: ProvidersGridProps) => {
  let instance = useCurrentInstance();
  let providers = useProviderListings(instance.data?.id, filter);
  let isHome = mode === 'home';

  return renderWithPagination(providers)(providers => (
    <>
      {providers.data.items.length > 0 && (
        <ItemGrid.Root columns={isHome ? 3 : undefined} width={isHome ? '220px' : '300px'}>
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
              <ProviderLink key={listing.id} to={href}>
                <ItemGrid.Item
                  entity={{ id: listing.id, hasUsage: true }}
                  title={listing.name}
                  description={isHome ? undefined : description}
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
                    <Categories $mode={mode}>
                      {listing.categories.map(category => (
                        <Category $mode={mode} key={category.id}>
                          {category.name}
                        </Category>
                      ))}
                    </Categories>
                  }
                />
              </ProviderLink>
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
