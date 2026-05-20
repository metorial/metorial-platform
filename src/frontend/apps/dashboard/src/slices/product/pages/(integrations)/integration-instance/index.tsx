import { renderWithLoader } from '@metorial/data-hooks';
import {
  IntegrationInstanceProvider,
  IntegrationProvider,
  useCurrentInstance,
  useIntegration,
  useIntegrationInstance,
  useIntegrationInstanceProviders,
  useProviderListings
} from '@metorial/state';
import {
  Attributes,
  Avatar,
  Badge,
  Button,
  Callout,
  Entity,
  Spacer,
  Text
} from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { showIntegrationInstanceProviderPanelFlow } from '../../../scenes/integrations/providerPanelFlow';

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

let getProviderConfigLabel = (
  provider: IntegrationProvider,
  instanceProvider?: IntegrationInstanceProvider
) =>
  instanceProvider?.config?.name ??
  instanceProvider?.config?.id ??
  provider.config?.name ??
  provider.config?.id ??
  'None';

let getProviderAuthLabel = (
  provider: IntegrationProvider,
  instanceProvider?: IntegrationInstanceProvider
) =>
  instanceProvider?.authConfig?.name ??
  instanceProvider?.authConfig?.id ??
  provider.authMethod?.name ??
  provider.authCredentials?.id ??
  'None';

type ProviderListingPreview = {
  name: string | null | undefined;
  imageUrl: string | null | undefined;
};

let getIntegrationInstanceStatusColor = (status: string) => {
  if (status === 'active') return 'green';
  if (status === 'draft') return 'orange';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export let IntegrationInstanceOverviewPage = () => {
  let instance = useCurrentInstance();
  let { integrationInstanceId } = useParams();
  let integrationInstance = useIntegrationInstance(instance.data?.id, integrationInstanceId);
  let integration = useIntegration(instance.data?.id, integrationInstance.data?.integrationId);
  let instanceProviders = useIntegrationInstanceProviders(instance.data?.id, {
    integrationInstanceId,
    status: ['active', 'archived']
  });

  let providerIds = useMemo(
    () =>
      [
        ...new Set((integration.data?.providers ?? []).map(provider => provider.provider.id))
      ].sort(),
    [integration.data?.providers]
  );

  let providerListings = useProviderListings(
    instance.data?.id,
    providerIds.length > 0 ? { id: providerIds, limit: 100 } : null
  );

  let renderOverview = (
    integrationData: NonNullable<typeof integration.data>,
    integrationInstanceData: NonNullable<typeof integrationInstance.data>,
    integrationProviders: IntegrationProvider[],
    providersById: Map<string, ProviderListingPreview>
  ) => {
    let instanceProviderByIntegrationProviderId = new Map(
      (instanceProviders.data?.items ?? []).map(
        provider => [provider.integrationProvider.id, provider] as const
      )
    );

    let rows = integrationProviders.map(provider => ({
      integrationProvider: provider,
      instanceProvider: instanceProviderByIntegrationProviderId.get(provider.id)
    }));

    let onComplete = () => {
      integrationInstance.refetch();
      instanceProviders.refetch();
    };

    return (
      <>
        <Attributes
          itemWidth="360px"
          attributes={[
            { label: 'ID', content: <ID id={integrationInstanceData.id} /> },
            {
              label: 'Status',
              content: (
                <Badge
                  color={getIntegrationInstanceStatusColor(integrationInstanceData.status)}
                >
                  {capitalize(integrationInstanceData.status)}
                </Badge>
              )
            },
            {
              label: 'Identity',
              content: integrationInstanceData.identityId ? (
                <ID id={integrationInstanceData.identityId} />
              ) : (
                '-'
              )
            }
          ]}
        />

        {integrationInstanceData.status === 'draft' ? (
          <>
            <Spacer height={20} />
            <Callout color="orange">
              This integration instance is still a draft and cannot be used yet. It first needs
              to be configured.
            </Callout>
          </>
        ) : null}

        <Spacer height={20} />

        <Box
          title="Providers"
          description="Review the providers attached to this integration and configure per-instance overrides where needed."
        >
          {rows.length === 0 ? (
            <Text size="2" color="gray600" align="center" style={{ padding: '20px 0' }}>
              This integration does not have any providers yet.
            </Text>
          ) : (
            <Items>
              {rows.map(({ integrationProvider, instanceProvider }) => {
                let listing = providersById.get(integrationProvider.provider.id);
                let displayName =
                  listing?.name ??
                  integrationProvider.provider.name ??
                  integrationProvider.provider.slug;
                let description =
                  integrationProvider.provider.slug &&
                  integrationProvider.provider.slug !== displayName
                    ? integrationProvider.provider.slug
                    : instanceProvider
                      ? 'Instance override configured'
                      : 'Using integration defaults';

                return (
                  <Entity.Wrapper key={integrationProvider.id} aligned>
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

                      <Entity.Field
                        title="Config"
                        value={getProviderConfigLabel(integrationProvider, instanceProvider)}
                      />

                      <Entity.Field
                        title="Auth"
                        value={getProviderAuthLabel(integrationProvider, instanceProvider)}
                      />

                      <Entity.Field
                        title="Status"
                        value={
                          instanceProvider ? (
                            <Badge size="2" color="green">
                              Configured
                            </Badge>
                          ) : integrationInstanceData.status === 'draft' ? (
                            <Badge size="2" color="orange">
                              Pending
                            </Badge>
                          ) : (
                            <Badge size="2" color="gray">
                              Inherited
                            </Badge>
                          )
                        }
                      />

                      <Entity.Field title="Actions" right>
                        <Actions>
                          <Button
                            size="1"
                            variant="outline"
                            onClick={() =>
                              showIntegrationInstanceProviderPanelFlow({
                                integration: integrationData,
                                integrationInstance: integrationInstanceData,
                                integrationProvider,
                                instanceProvider,
                                onComplete
                              })
                            }
                          >
                            {instanceProvider ? 'Edit' : 'Configure'}
                          </Button>
                        </Actions>
                      </Entity.Field>
                    </Entity.Content>
                  </Entity.Wrapper>
                );
              })}
            </Items>
          )}
        </Box>
      </>
    );
  };

  if (providerIds.length > 0) {
    return renderWithLoader({
      integrationInstance,
      integration,
      instanceProviders,
      providerListings
    })(({ integrationInstance, integration, providerListings }) => {
      let providersById = new Map<string, ProviderListingPreview>();

      for (let listing of providerListings.data.items) {
        providersById.set(listing.provider.id, {
          name: listing.name ?? listing.provider.name,
          imageUrl: listing.imageUrl
        });
      }

      return renderOverview(
        integration.data,
        integrationInstance.data,
        integration.data.providers ?? [],
        providersById
      );
    });
  }

  return renderWithLoader({ integrationInstance, integration, instanceProviders })(
    ({ integration, integrationInstance }) =>
      renderOverview(
        integration.data,
        integrationInstance.data,
        integration.data.providers ?? [],
        new Map()
      )
  );
};
