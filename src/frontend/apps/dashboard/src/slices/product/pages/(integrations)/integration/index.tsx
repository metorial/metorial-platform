import { renderWithLoader } from '@metorial/data-hooks';
import {
  IntegrationPreview,
  IntegrationProvider,
  useAllIntegrationProviders,
  useCurrentInstance,
  useDeleteIntegrationProvider,
  useIntegration,
  useProviderListings
} from '@metorial/state';
import { Attributes, Avatar, Button, confirm, Entity, Menu, Spacer, Text } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { RiMore2Line } from '@remixicon/react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { showIntegrationProviderPanelFlow } from '../../../scenes/integrations/providerPanelFlow';

let Items = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let Actions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

let getProviderConfigLabel = (provider: IntegrationProvider) => {
  let configLabel = provider.config?.name ?? provider.config?.id ?? null;
  let authLabel = provider.authMethod?.name ?? provider.authCredentials?.id ?? null;

  if (configLabel && authLabel) return `${configLabel} and ${authLabel}`;
  if (configLabel) return configLabel;
  if (authLabel) return authLabel;
  return 'None';
};

let ProvidersList = ({
  integration,
  providers,
  listingByProviderId,
  onAddProvider,
  onEditProvider,
  onDeleteProvider
}: {
  integration: IntegrationPreview;
  providers: IntegrationProvider[];
  listingByProviderId: Map<
    string,
    { name: string | null | undefined; imageUrl: string | null | undefined }
  >;
  onAddProvider: () => void;
  onEditProvider: (provider: IntegrationProvider) => void;
  onDeleteProvider: (provider: IntegrationProvider) => void;
}) => {
  return (
    <Box
      title="Providers"
      description="Providers define the shared deployment, config, auth, and tool contract for this integration."
      rightActions={
        <Button size="2" onClick={onAddProvider}>
          Add Provider
        </Button>
      }
    >
      {providers.length === 0 ? (
        <Text size="2" color="gray600" align="center" style={{ padding: '20px 0' }}>
          No providers are attached to this integration yet.
        </Text>
      ) : (
        <Items>
          {providers.map(provider => {
            let listing = listingByProviderId.get(provider.provider.id);
            let displayName =
              listing?.name ?? provider.provider.name ?? provider.provider.slug;
            let description =
              provider.provider.slug && provider.provider.slug !== displayName
                ? provider.provider.slug
                : undefined;

            return (
              <Entity.Wrapper key={provider.id} aligned>
                <Entity.Content>
                  <Entity.Field
                    prefix={
                      <Avatar
                        entity={{
                          name: displayName,
                          photoUrl: listing?.imageUrl ?? undefined
                        }}
                        size={32}
                        radius={8}
                        noTooltip
                        imageFit="contain"
                      />
                    }
                    title={displayName}
                    description={description}
                  />

                  <Entity.Field title="Config" value={getProviderConfigLabel(provider)} />

                  <Entity.Field title="Actions" right>
                    <Actions>
                      <Button
                        size="1"
                        variant="outline"
                        onClick={() => onEditProvider(provider)}
                      >
                        Edit
                      </Button>
                      <Menu
                        items={[
                          { id: 'edit', label: 'Edit' },
                          { id: 'delete', label: 'Delete' }
                        ]}
                        onItemClick={item => {
                          if (item === 'edit') onEditProvider(provider);
                          if (item === 'delete') onDeleteProvider(provider);
                        }}
                      >
                        <Button
                          size="1"
                          variant="outline"
                          iconRight={<RiMore2Line />}
                          title="Provider options"
                        />
                      </Menu>
                    </Actions>
                  </Entity.Field>
                </Entity.Content>
              </Entity.Wrapper>
            );
          })}
        </Items>
      )}
    </Box>
  );
};

export let IntegrationOverviewPage = () => {
  let instance = useCurrentInstance();
  let { integrationId } = useParams();
  let integration = useIntegration(instance.data?.id, integrationId);
  let providers = useAllIntegrationProviders(instance.data?.id, integrationId);
  let deleteProvider = useDeleteIntegrationProvider();

  let providerIds = useMemo(
    () => [...new Set((providers.data ?? []).map(p => p.provider.id))].sort(),
    [providers.data]
  );

  let providerListings = useProviderListings(
    instance.data?.id,
    providerIds.length > 0 ? { id: providerIds, limit: 100 } : null
  );

  let renderOverview = (
    integrationData: IntegrationPreview,
    providerData: IntegrationProvider[],
    listingByProviderId: Map<
      string,
      { name: string | null | undefined; imageUrl: string | null | undefined }
    >
  ) => {
    let onComplete = () => {
      integration.refetch();
      providers.refetch();
    };

    let handleDeleteProvider = (provider: IntegrationProvider) => {
      let listing = listingByProviderId.get(provider.provider.id);
      let displayName =
        listing?.name ?? provider.provider.name ?? provider.provider.slug ?? 'this provider';

      confirm({
        title: `Remove ${displayName}?`,
        description: `Remove the ${displayName} provider from this integration?`,
        confirmText: 'Remove',
        onConfirm: async () => {
          if (!instance.data) return;
          await deleteProvider.mutate({
            instanceId: instance.data.id,
            integrationProviderId: provider.id
          });
          onComplete();
        }
      });
    };

    return (
      <>
        <Attributes
          itemWidth="360px"
          attributes={[
            { label: 'ID', content: <ID id={integrationData.id} /> },
            { label: 'Status', content: integrationData.status },
            { label: 'Slug', content: integrationData.slug ?? '-' }
          ]}
        />

        <Spacer height={20} />

        <ProvidersList
          integration={integrationData}
          providers={providerData}
          listingByProviderId={listingByProviderId}
          onAddProvider={() =>
            showIntegrationProviderPanelFlow({
              integration: integrationData,
              onComplete
            })
          }
          onEditProvider={provider =>
            showIntegrationProviderPanelFlow({
              integration: integrationData,
              integrationProvider: provider,
              onComplete
            })
          }
          onDeleteProvider={handleDeleteProvider}
        />
      </>
    );
  };

  if (providerIds.length > 0) {
    return renderWithLoader({ integration, providers, providerListings })(
      ({ integration, providers, providerListings }) => {
        let listingByProviderId = new Map<
          string,
          { name: string | null | undefined; imageUrl: string | null | undefined }
        >();

        for (let listing of providerListings.data.items) {
          listingByProviderId.set(listing.provider.id, {
            name: listing.name ?? listing.provider.name,
            imageUrl: listing.imageUrl
          });
        }

        return renderOverview(integration.data, providers.data, listingByProviderId);
      }
    );
  }

  return renderWithLoader({ integration, providers })(({ integration, providers }) =>
    renderOverview(integration.data, providers.data, new Map())
  );
};
