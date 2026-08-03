import type { DashboardInstanceProviderListingsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderListings } from '@metorial/state';
import { Avatar, Text, theme } from '@metorial/ui';
import { RiArrowRightSLine } from '@remixicon/react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

let Table = styled.div`
  display: flex;
  flex-direction: column;
  border-top: 1px solid ${theme.colors.gray300};
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let Row = styled(Link)`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, auto);
  gap: 16px;
  align-items: center;
  min-width: 0;
  padding: 8px 10px;
  border-bottom: 1px solid ${theme.colors.gray300};
  color: inherit;
  text-decoration: none;
  transition:
    background 0.14s ease,
    box-shadow 0.14s ease;

  &:last-child {
    border-bottom: 0;
  }

  &:hover,
  &:focus-visible {
    background: ${theme.colors.gray100};
    box-shadow: inset 3px 0 0 ${theme.colors.gray400};
  }

  @media (max-width: 600px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }

  &[data-has-side-content='true'] {
    @media (max-width: 1000px) {
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }
  }
`;

let ProviderCell = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

let ProviderName = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.gray800};
`;

let MetaCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
  color: ${theme.colors.gray600};

  @media (max-width: 600px) {
    justify-content: flex-start;
  }
`;

let Categories = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 5px;
  min-width: 0;

  @media (max-width: 600px) {
    justify-content: flex-start;
  }
`;

let Category = styled.div`
  display: flex;
  align-items: center;
  max-width: 180px;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  background: ${theme.colors.gray200};
  color: ${theme.colors.gray800};
  font-size: 11px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let Arrow = styled(RiArrowRightSLine)`
  flex-shrink: 0;
`;

export let HomeProvidersTable = (filter: DashboardInstanceProviderListingsListQuery) => {
  let instance = useCurrentInstance();
  let providers = useProviderListings(instance.data?.id, filter);

  return renderWithPagination(providers)(providers => (
    <>
      {providers.data.items.length > 0 && (
        <Table>
          {providers.data.items.map(listing => {
            let providerSlug = listing.provider?.slug;
            if (!providerSlug) return null;

            let href = Paths.instance.provider(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              providerSlug
            );

            return (
              <Row
                key={listing.id}
                to={href}
                data-has-side-content={!!listing.categories.length}
              >
                <ProviderCell>
                  <Avatar
                    entity={{
                      name: listing.name,
                      photoUrl: listing.imageUrl
                    }}
                    size={26}
                    radius={6}
                    imageFit="contain"
                  />

                  <ProviderName>{listing.name}</ProviderName>
                </ProviderCell>

                <MetaCell>
                  <Categories>
                    {listing.categories.map(category => (
                      <Category key={category.id}>{category.name}</Category>
                    ))}
                  </Categories>

                  <Arrow size={16} />
                </MetaCell>
              </Row>
            );
          })}
        </Table>
      )}

      {providers.data.items.length == 0 && (
        <Text size="2" color="gray600">
          No providers found
        </Text>
      )}
    </>
  ));
};
