import { renderWithPagination } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderDeployments } from '@metorial/state';
import { Entity, RenderDate, Spacer, Text } from '@metorial/ui';
import styled from 'styled-components';

type ProviderDeployment = {
  id: string;
  name: string | null;
  description: string | null;
  providerId: string;
  createdAt: string;
};

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
  onDeploymentClick
}: {
  providerId?: string | string[];
  order?: 'asc' | 'desc';
  onDeploymentClick?: (deployment: ProviderDeployment) => void;
}) => {
  let instance = useCurrentInstance();
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

    if (sortedDeployments.length === 0) {
      return (
        <>
          <Spacer size={20} />
          <Text size="2" color="gray600" align="center">
            No deployments found. Create one to get started.
          </Text>
        </>
      );
    }

    return (
      <>
        <Spacer size={15} />
        <Items>
          {sortedDeployments.map(deployment => {
            let inner = (
              <Entity.Wrapper>
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
                onClick={() => onDeploymentClick?.(deployment as unknown as ProviderDeployment)}
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
