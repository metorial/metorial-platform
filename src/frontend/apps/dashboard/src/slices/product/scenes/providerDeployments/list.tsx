import { DashboardInstanceProviderDeploymentsListOutput } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderDeployments } from '@metorial/state';
import { Entity, Input, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { useState } from 'react';
import styled from 'styled-components';
import { useDebounced } from '../../../../hooks/useDebounced';

type ProviderDeployment = DashboardInstanceProviderDeploymentsListOutput['items'][number];

let Items = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
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
`;

export let ProviderDeploymentsList = ({
  providerId,
  order = 'desc',
  onDeploymentClick,
  searchable = false,
  selectedDeploymentId,
  emptyText = 'No deployments found. Create one to get started.'
}: {
  providerId?: string | string[];
  order?: 'asc' | 'desc';
  onDeploymentClick?: (deployment: ProviderDeployment) => void;
  searchable?: boolean;
  selectedDeploymentId?: string;
  emptyText?: string;
}) => {
  let instance = useCurrentInstance();
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 300);
  let deployments = useProviderDeployments(instance.data?.id, {
    providerId: providerId
      ? Array.isArray(providerId)
        ? providerId[0]
        : providerId
      : undefined
  });

  return renderWithPagination(deployments)(deployments => {
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
      <>
        {searchable && (
          <>
            <Input
              label="Search"
              hideLabel
              placeholder="Search deployments..."
              value={search}
              onInput={value => setSearch(value)}
            />
            <Spacer size={15} />
          </>
        )}

        {filteredDeployments.length === 0 && (
          <Text size="2" color="gray600" align="center">
            No deployments found matching your search.
          </Text>
        )}

        {filteredDeployments.length > 0 && <Spacer size={15} />}
        <Items>
          {filteredDeployments.map(deployment => {
            let inner = (
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
                    title={deployment.name ?? 'Unnamed Deployment'}
                    description={
                      deployment.description ? (
                        <>
                          {deployment.description.substring(0, 80)}
                          {deployment.description.length > 80 ? '...' : ''}
                        </>
                      ) : undefined
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
            );

            return (
              <ItemButton
                key={deployment.id}
                onClick={() => onDeploymentClick?.(deployment)}
                type="button"
              >
                {inner}
              </ItemButton>
            );
          })}
        </Items>
      </>
    );
  });
};
