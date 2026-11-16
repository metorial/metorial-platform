import { DashboardInstanceProviderDeploymentsListOutput } from '@metorial/dashboard-sdk';
import { createDataList } from '@metorial/data-list';
import {
  useCurrentInstance,
  useProviderDeployments,
  useProviderListings
} from '@metorial/state';
import { Avatar, Entity, Or, RenderDate, Spacer, Text, theme, Tooltip } from '@metorial/ui';
import { createContext, useContext, useMemo } from 'react';
import styled from 'styled-components';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';

type ProviderDeployment = DashboardInstanceProviderDeploymentsListOutput['items'][number];
type ProviderInfo = {
  name?: string | null;
  imageUrl?: string | null;
};
type PickerDeployment = ProviderDeployment & { providerInfo?: ProviderInfo };
type DeploymentSelectionMode =
  | 'default'
  | 'configCreate'
  | 'configVaultCreate'
  | 'authConfigCreate'
  | 'authCredentialsCreate';

let Items = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let GridItems = styled.div<{ $columns?: number }>`
  display: grid;
  grid-template-columns: ${({ $columns }) =>
    $columns
      ? `repeat(${$columns}, minmax(0, 1fr))`
      : 'repeat(auto-fill, minmax(150px, 1fr))'};
  gap: 10px;

  @media (max-width: 700px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 520px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

let ItemButton = styled.button`
  display: flex;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  width: 100%;
  flex-direction: column;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }
`;

let CompactCard = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: none;
  min-width: 0;
  overflow: hidden;
  transition:
    border-color 0.15s,
    background 0.15s;
`;

let CompactName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.gray800};
  line-height: 14px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let ProviderDeploymentListItem = ({
  deployment,
  providerInfo,
  compact,
  selectedDeploymentId,
  onDeploymentClick,
  selectionMode
}: {
  deployment: ProviderDeployment;
  providerInfo?: {
    name?: string | null;
    imageUrl?: string | null;
  };
  compact?: boolean;
  selectedDeploymentId?: string;
  onDeploymentClick?: (deployment: ProviderDeployment) => void;
  selectionMode: DeploymentSelectionMode;
}) => {
  let instance = useCurrentInstance();
  let authCreation = useProviderAuthCreationCapabilities(
    selectionMode === 'authConfigCreate' || selectionMode === 'authCredentialsCreate'
      ? instance.data?.id
      : null,
    selectionMode === 'authConfigCreate' || selectionMode === 'authCredentialsCreate'
      ? deployment.id
      : null,
    selectionMode === 'authConfigCreate' || selectionMode === 'authCredentialsCreate'
      ? deployment.providerId
      : null
  );

  let disabledReason =
    selectionMode === 'authConfigCreate'
      ? authCreation.authConfigDisabledReason
      : selectionMode === 'authCredentialsCreate'
        ? authCreation.authCredentialsDisabledReason
        : null;
  let isDisabled =
    selectionMode === 'authConfigCreate'
      ? !authCreation.canCreateAuthConfig
      : selectionMode === 'authCredentialsCreate'
        ? !authCreation.canCreateAuthCredentials
        : false;
  let description = deployment.description ? (
    <>
      {deployment.description.substring(0, 80)}
      {deployment.description.length > 80 ? '...' : ''}
    </>
  ) : undefined;
  let providerName = providerInfo?.name ?? deployment.providerId;

  return (
    <Tooltip content={disabledReason ?? ''} enabled={!!disabledReason} delayDuration={0}>
      <div style={{ display: 'flex' }}>
        <ItemButton
          key={deployment.id}
          onClick={() => onDeploymentClick?.(deployment)}
          type="button"
          disabled={isDisabled}
        >
          {compact ? (
            <CompactCard
              style={
                selectedDeploymentId === deployment.id
                  ? {
                      borderColor: theme.colors.blue500,
                      background: 'rgba(59, 130, 246, 0.04)'
                    }
                  : undefined
              }
            >
              <Avatar
                entity={{
                  name: providerName,
                  imageUrl: providerInfo?.imageUrl
                }}
                size={24}
                radius={8}
                noTooltip
                imageFit="contain"
              />

              <CompactName>{deployment.name ?? 'Unnamed Deployment'}</CompactName>
            </CompactCard>
          ) : (
            <Entity.Wrapper
              style={
                selectedDeploymentId === deployment.id
                  ? {
                      borderColor: theme.colors.blue500,
                      background: 'rgba(59, 130, 246, 0.04)'
                    }
                  : undefined
              }
            >
              <Entity.Content>
                <Entity.Field
                  prefix={
                    <Avatar
                      entity={{
                        name: providerName,
                        imageUrl: providerInfo?.imageUrl
                      }}
                      size={28}
                      radius={8}
                      noTooltip
                      imageFit="contain"
                    />
                  }
                  title={deployment.name ?? 'Unnamed Deployment'}
                  description={providerName}
                />
                <Entity.Field
                  title={
                    <Text size="1" color="gray700">
                      <RenderDate date={deployment.createdAt} />
                    </Text>
                  }
                  right
                />
              </Entity.Content>
            </Entity.Wrapper>
          )}
        </ItemButton>
      </div>
    </Tooltip>
  );
};

type PickerSelection = {
  compact: boolean;
  columns?: number;
  selectedDeploymentId?: string;
  onDeploymentClick?: (deployment: ProviderDeployment) => void;
  selectionMode: DeploymentSelectionMode;
};

let PickerSelectionContext = createContext<PickerSelection>({
  compact: false,
  selectionMode: 'default'
});

let PickerLayout = ({ items }: { items: PickerDeployment[] }) => {
  let selection = useContext(PickerSelectionContext);

  let rows = items.map(deployment => (
    <ProviderDeploymentListItem
      key={deployment.id}
      deployment={deployment}
      providerInfo={deployment.providerInfo}
      compact={selection.compact}
      onDeploymentClick={selection.onDeploymentClick}
      selectedDeploymentId={selection.selectedDeploymentId}
      selectionMode={selection.selectionMode}
    />
  ));

  return selection.compact ? (
    <GridItems $columns={selection.columns}>{rows}</GridItems>
  ) : (
    <Items>{rows}</Items>
  );
};

let ProviderDeploymentPickerList = createDataList<{
  providerId?: string;
  order?: 'asc' | 'desc';
}>('provider-deployments-picker', { customizable: false })
  .context(() => ({ instanceId: useCurrentInstance().data?.id }))
  .search('Search deployments…')
  .paginated(({ props, ctx, search, limit }) =>
    useProviderDeployments(ctx.instanceId, {
      ...(limit ? { limit } : {}),
      ...(search ? { search } : {}),
      order: props.order ?? 'desc',
      providerId: props.providerId
    })
  )
  .enrich((items, { ctx }) => {
    let providerIds = useMemo(
      () => [...new Set(items.map(deployment => deployment.providerId))].sort(),
      [items]
    );
    let listings = useProviderListings(
      ctx.instanceId,
      providerIds.length > 0 ? { id: providerIds, limit: 100 } : null
    );

    let enriched = useMemo<PickerDeployment[]>(() => {
      let lookup = new Map<string, ProviderInfo>();

      for (let listing of listings.data?.items ?? []) {
        lookup.set(listing.provider.id, {
          name: listing.name ?? listing.provider.name,
          imageUrl: listing.imageUrl
        });
      }

      return items.map(deployment => ({
        ...deployment,
        providerInfo: lookup.get(deployment.providerId)
      }));
    }, [items, listings.data?.items]);

    return {
      items: enriched,
      isLoading: providerIds.length > 0 && listings.isLoading,
      error: providerIds.length > 0 ? listings.error : null
    };
  })
  .layout('compact', {
    label: 'Compact',
    render: ({ items }) => <PickerLayout items={items} />
  })
  .layout('cards', { label: 'Cards', render: ({ items }) => <PickerLayout items={items} /> })
  .build();

export let ProviderDeploymentsList = ({
  providerId,
  order = 'desc',
  onDeploymentClick,
  searchable = true,
  compact = false,
  columns,
  limit,
  sectionLabel,
  selectedDeploymentId,
  emptyText = 'No deployments found. Create one to get started.',
  selectionMode = 'default'
}: {
  providerId?: string | string[];
  order?: 'asc' | 'desc';
  onDeploymentClick?: (deployment: ProviderDeployment) => void;
  searchable?: boolean;
  compact?: boolean;
  columns?: number;
  limit?: number;
  sectionLabel?: string;
  selectedDeploymentId?: string;
  emptyText?: string;
  selectionMode?: DeploymentSelectionMode;
}) => {
  let selection = useMemo(
    () => ({ compact, columns, selectedDeploymentId, onDeploymentClick, selectionMode }),
    [compact, columns, selectedDeploymentId, onDeploymentClick, selectionMode]
  );

  return (
    <PickerSelectionContext.Provider value={selection}>
      <ProviderDeploymentPickerList
        providerId={Array.isArray(providerId) ? providerId[0] : providerId}
        order={order}
        listVariant="embedded"
        listLayouts={[compact ? 'compact' : 'cards']}
        listLimit={limit}
        hideToolbar={!searchable}
        topContent={
          sectionLabel ? (
            <>
              <Or text={sectionLabel} />
              <Spacer size={10} />
            </>
          ) : undefined
        }
        emptyState={{
          initial: emptyText,
          filtered: 'No deployments found matching your search.',
          search: 'No deployments found matching your search.'
        }}
      />
    </PickerSelectionContext.Provider>
  );
};
