import type { DashboardInstanceIntegrationsListQuery } from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useAllProviderListings,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegrations
} from '@metorial/state';
import { Avatar, Text, theme } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { EmptyState } from '@metorial/empty-state';
import { showCreateIntegrationProviderFirstFlow } from './providerPanelFlow';

let Alias = styled.div`
  background: ${theme.colors.gray300};
  min-height: 26px;
  border-radius: 999px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
  overflow-wrap: anywhere;
`;

let ProviderAvatarStack = styled.div`
  display: flex;
  align-items: center;
`;

let ProviderAvatarItem = styled.div<{ $index: number }>`
  position: relative;
  z-index: ${p => 10 - p.$index};
  margin-left: ${p => (p.$index === 0 ? '0' : '-8px')};
  border-radius: 999px;
  box-shadow: 0 0 0 2px ${theme.colors.background};
`;

export let IntegrationsGrid = (
  p: { instanceId: string } & Omit<
    DashboardInstanceIntegrationsListQuery,
    'after' | 'before' | 'cursor' | 'limit'
  >
) => {
  let { instanceId, ...query } = p;
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let integrations = useIntegrations(instanceId, {
    order: 'desc',
    ...query
  });
  let providerIds = useMemo(
    () =>
      [
        ...new Set(
          (integrations.data?.items ?? []).flatMap(integration =>
            (integration.providers ?? []).map(provider => provider.provider.id)
          )
        )
      ].sort(),
    [integrations.data?.items]
  );
  let providerListings = useAllProviderListings(instanceId, providerIds);
  let hasActiveFilters = !!(
    query.search ||
    query.providerId ||
    query.createdAt ||
    query.updatedAt ||
    query.status?.includes?.('deleted') ||
    query.status?.includes?.('archived')
  );

  let showCreateIntegrationModal = () => {
    if (!instance.data) return;

    showCreateIntegrationProviderFirstFlow({
      onCreate: integration => {
        navigate(
          Paths.instance.integration(
            organization.data,
            project.data,
            instance.data,
            integration.id
          )
        );
      }
    });
  };

  return renderWithPagination(integrations)(integrations =>
    renderWithLoader({ providerListings })(({ providerListings }) => {
      let listingLookup = new Map<
        string,
        { name: string | null | undefined; imageUrl: string | null | undefined }
      >();

      for (let listing of providerListings.data) {
        let preview = {
          name: listing.name ?? listing.provider.name,
          imageUrl: listing.imageUrl
        };

        listingLookup.set(listing.id, preview);
        listingLookup.set(listing.provider.id, preview);
      }

      return (
        <>
          {integrations.data.items.length > 0 && (
            <ItemGrid.Root width="300px">
              {integrations.data.items.map(integration => {
                let visibleProviders = (integration.providers ?? []).slice(0, 5);

                return (
                  <ItemGrid.Item
                    key={integration.id}
                    href={Paths.instance.integration(
                      organization.data,
                      project.data,
                      instance.data,
                      integration.id
                    )}
                    entity={{ id: integration.id, hasUsage: true }}
                    title={integration.name}
                    description={integration.description}
                    height={220}
                    icon={
                      visibleProviders.length > 0 ? (
                        <ProviderAvatarStack>
                          {visibleProviders.map((provider, idx) => {
                            let listing = listingLookup.get(provider.provider.id);
                            let name =
                              listing?.name ??
                              provider.provider.name ??
                              provider.provider.slug;

                            return (
                              <ProviderAvatarItem
                                key={provider.id ?? provider.provider.id}
                                $index={idx}
                              >
                                <Avatar
                                  entity={{
                                    name,
                                    photoUrl: listing?.imageUrl ?? undefined
                                  }}
                                  size={30}
                                  noTooltip
                                  imageFit="contain"
                                />
                              </ProviderAvatarItem>
                            );
                          })}
                        </ProviderAvatarStack>
                      ) : (
                        <Avatar entity={integration} size={30} />
                      )
                    }
                    bottom={
                      <div style={{ display: 'flex' }}>
                        <Alias>{integration.slug}</Alias>
                      </div>
                    }
                  />
                );
              })}
            </ItemGrid.Root>
          )}

          {integrations.data.items.length === 0 && query.search && (
            <Text size="2" color="gray600">
              No integrations found.
            </Text>
          )}

          {integrations.data.items.length === 0 && !hasActiveFilters && (
            <EmptyState
              extra="Integrations"
              title="Create your first integration"
              description="Integrations define reusable provider contracts that can be configured once and materialized into integration instances."
              action={{
                label: 'Create Integration',
                onClick: showCreateIntegrationModal
              }}
            />
          )}

          {integrations.data.items.length === 0 && !query.search && hasActiveFilters && (
            <Text size="2" color="gray600">
              No integrations match the current filters.
            </Text>
          )}
        </>
      );
    })
  );
};
