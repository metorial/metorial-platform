import { DashboardInstanceProviderDeploymentsListOutput } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderDeployments,
  useProviderListings
} from '@metorial/state';
import {
  Avatar,
  Entity,
  Input,
  Or,
  RenderDate,
  Spacer,
  Text,
  theme,
  Tooltip
} from '@metorial/ui';
import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useDebounced } from '../../../../hooks/useDebounced';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';

type ProviderDeployment = DashboardInstanceProviderDeploymentsListOutput['items'][number];
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
                  description={
                    <>
                      <Text size="1" color="gray600">
                        {providerName}
                      </Text>
                      {(description || disabledReason) && <br />}
                      {description}
                      {disabledReason && (
                        <>
                          {description ? <br /> : null}
                          <Text size="1" color="gray500">
                            {disabledReason}
                          </Text>
                        </>
                      )}
                    </>
                  }
                />
                <Entity.Field
                  title={
                    <Text size="1" color="gray500">
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

export let ProviderDeploymentsList = ({
  providerId,
  order = 'desc',
  onDeploymentClick,
  searchable = false,
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
  let instance = useCurrentInstance();
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 300);
  let deployments = useProviderDeployments(instance.data?.id, {
    ...(limit ? { limit } : {}),
    providerId: providerId
      ? Array.isArray(providerId)
        ? providerId[0]
        : providerId
      : undefined
  });
  let providerIds = useMemo(
    () =>
      [
        ...new Set((deployments.data?.items ?? []).map(deployment => deployment.providerId))
      ].sort(),
    [deployments.data?.items]
  );
  let providerListings = useProviderListings(
    instance.data?.id,
    providerIds.length > 0
      ? {
          orderByRank: true,
          limit: Math.max(providerIds.length, 100)
        }
      : null
  );

  return renderWithPagination(deployments, {
    hidePaginationWhenUnavailable: true
  })(deployments => {
    let providerLookup = new Map<
      string,
      {
        name?: string | null;
        imageUrl?: string | null;
      }
    >();

    for (let providerListing of providerListings.data?.items ?? []) {
      if (!providerIds.includes(providerListing.provider.id)) continue;
      providerLookup.set(providerListing.provider.id, {
        name: providerListing.name ?? providerListing.provider.name,
        imageUrl: providerListing.imageUrl
      });
    }

    let sortedDeployments = [...deployments.data.items].sort((a, b) => {
      let dateA = new Date(a.createdAt).getTime();
      let dateB = new Date(b.createdAt).getTime();
      return order === 'desc' ? dateB - dateA : dateA - dateB;
    });
    let filteredDeployments = sortedDeployments.filter(deployment => {
      if (!searchDebounced.trim()) return true;

      let query = searchDebounced.toLowerCase();
      return (
        (deployment.name ?? '').toLowerCase().includes(query) ||
        (deployment.description ?? '').toLowerCase().includes(query) ||
        deployment.id.toLowerCase().includes(query)
      );
    });

    if (sortedDeployments.length === 0) {
      return (
        <>
          <Spacer size={20} />
          <Text size="2" color="gray600" align="center">
            {emptyText}
          </Text>
        </>
      );
    }

    return (
      <div>
        {searchable && (
          <>
            <Input
              label="Search"
              hideLabel
              placeholder="Search deployments..."
              value={search}
              onInput={value => setSearch(value)}
            />
            {sectionLabel ? (
              <>
                <Spacer size={10} />
                <Or text={sectionLabel} />
                <Spacer size={10} />
              </>
            ) : (
              <Spacer size={10} />
            )}
          </>
        )}

        {filteredDeployments.length === 0 && (
          <Text size="2" color="gray600" align="center">
            No deployments found matching your search.
          </Text>
        )}

        {!searchable && filteredDeployments.length > 0 && <Spacer size={10} />}
        {compact ? (
          <GridItems $columns={columns}>
            {filteredDeployments.map(deployment => (
              <ProviderDeploymentListItem
                key={deployment.id}
                deployment={deployment}
                providerInfo={providerLookup.get(deployment.providerId)}
                compact={compact}
                onDeploymentClick={onDeploymentClick}
                selectedDeploymentId={selectedDeploymentId}
                selectionMode={selectionMode}
              />
            ))}
          </GridItems>
        ) : (
          <Items>
            {filteredDeployments.map(deployment => (
              <ProviderDeploymentListItem
                key={deployment.id}
                deployment={deployment}
                providerInfo={providerLookup.get(deployment.providerId)}
                compact={compact}
                onDeploymentClick={onDeploymentClick}
                selectedDeploymentId={selectedDeploymentId}
                selectionMode={selectionMode}
              />
            ))}
          </Items>
        )}
      </div>
    );
  });
};
