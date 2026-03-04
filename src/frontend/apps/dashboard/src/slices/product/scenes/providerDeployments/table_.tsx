import {
  DashboardInstanceProviderDeploymentsListOutput,
  DashboardInstanceProviderDeploymentsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderDeployments } from '@metorial/state';
import { Entity, Input, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDebounced } from '../../../../hooks/useDebounced';

export type ServerDeployment = DashboardInstanceProviderDeploymentsListOutput['items'][number];

export let ServerDeploymentsTable = (
  filter: DashboardInstanceProviderDeploymentsListQuery & {
    withSearch?: string;
  }
) => {
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  let instance = useCurrentInstance();
  let deployments = useProviderDeployments(instance.data?.id, {
    providerId:
      typeof filter.providerId === 'string'
        ? filter.providerId
        : Array.isArray(filter.providerId)
          ? filter.providerId[0]
          : undefined,
    providerVersionId:
      typeof filter.providerVersionId === 'string'
        ? filter.providerVersionId
        : Array.isArray(filter.providerVersionId)
          ? filter.providerVersionId[0]
          : undefined,
    status: filter.status,
    search: searchDebounced.length ? searchDebounced : undefined
  });

  return (
    <>
      <Input
        label="Search"
        hideLabel
        placeholder="Search for providers"
        value={search}
        onInput={v => setSearch(v)}
      />

      <Spacer size={15} />

      {renderWithPagination(deployments)(deployments => (
        <>
          <Table
            headers={['Info', 'Provider', 'Created']}
            data={deployments.data.items.map(deployment => ({
              data: [
                <Text size="2" weight="strong">
                  {deployment.name ?? (
                    <span style={{ color: theme.colors.gray600 }}>Untitled</span>
                  )}

                  {deployment.description && (
                    <Text size="2" color="gray600">
                      {deployment.description.slice(0, 60)}
                      {deployment.description.length > 60 ? '...' : ''}
                    </Text>
                  )}
                </Text>,
                <Text size="2" weight="strong">
                  {deployment.providerId}
                </Text>,
                <RenderDate date={deployment.createdAt} />
              ],
              href: Paths.instance.providerDeployment(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                deployment.id
              )
            }))}
          />

          {deployments.data.items.length == 0 && (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No deployments found.
            </Text>
          )}
        </>
      ))}
    </>
  );
};

export let ServerDeploymentsList = (
  filter: DashboardInstanceProviderDeploymentsListQuery & {
    onDeploymentClick?: (deployment: ServerDeployment) => void;
  }
) => {
  let instance = useCurrentInstance();
  let deployments = useProviderDeployments(instance.data?.id, {
    providerId: typeof filter.providerId === 'string' ? filter.providerId : undefined,
    status: filter.status,
    search: filter.search
  });

  return renderWithPagination(deployments)(deployments => (
    <ServerDeploymentsListItems
      deployments={deployments.data.items}
      onDeploymentClick={filter.onDeploymentClick}
    />
  ));
};

export let ServerDeploymentsListItems = ({
  deployments,
  onDeploymentClick
}: {
  deployments: ServerDeployment[];
  onDeploymentClick?: (deployment: ServerDeployment) => void;
}) => {
  let instance = useCurrentInstance();

  return (
    <>
      {deployments.map(deployment => {
        let inner = (
          <Entity.Wrapper>
            <Entity.Content>
              <Entity.Field
                title={
                  deployment.name ?? (
                    <span style={{ color: theme.colors.gray600 }}>Untitled</span>
                  )
                }
                description={
                  deployment.description && (
                    <>
                      {deployment.description.slice(0, 60)}
                      {deployment.description.length > 60 ? '...' : ''}
                    </>
                  )
                }
              />

              <Entity.Field
                title={
                  <Text size="2">{deployment.providerId}</Text>
                }
                value={<RenderDate date={deployment.createdAt} />}
              />
            </Entity.Content>
          </Entity.Wrapper>
        );

        if (onDeploymentClick) {
          return (
            <button
              key={deployment.id}
              onClick={() => {
                onDeploymentClick(deployment);
              }}
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                width: '100%',
                textAlign: 'left'
              }}
            >
              {inner}
            </button>
          );
        }

        return (
          <Link
            key={deployment.id}
            to={Paths.instance.providerDeployment(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              deployment.id
            )}
          >
            {inner}
          </Link>
        );
      })}

      {deployments.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No deployments found
        </Text>
      )}
    </>
  );
};
