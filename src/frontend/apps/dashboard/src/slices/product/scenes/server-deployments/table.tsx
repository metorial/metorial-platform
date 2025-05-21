import { ServersDeploymentsGetOutput } from '@metorial/core';
import { ServersDeploymentsListQuery } from '@metorial/core/src/mt_2025_01_01_dashboard';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useServerDeployments } from '@metorial/state';
import { Entity, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ServerDeploymentsTable = (filter: ServersDeploymentsListQuery) => {
  let instance = useCurrentInstance();
  let deployments = useServerDeployments(instance.data?.id, filter);

  return renderWithPagination(deployments)(deployments => (
    <>
      <Table
        headers={['Info', 'Server', 'Created']}
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
              {deployment.server.name}
            </Text>,
            <RenderDate date={deployment.createdAt} />
          ],
          href: Paths.instance.serverDeployment(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            deployment.id
          )
        }))}
      />

      {deployments.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No deployments found
        </Text>
      )}
    </>
  ));
};

export let ServerDeploymentsList = (
  filter: ServersDeploymentsListQuery & {
    onDeploymentClick?: (deployment: ServersDeploymentsGetOutput) => void;
  }
) => {
  let instance = useCurrentInstance();
  let deployments = useServerDeployments(instance.data?.id, filter);

  return renderWithPagination(deployments)(deployments => (
    <>
      {deployments.data.items.map(deployment => (
        <button
          key={deployment.id}
          onClick={() => {
            if (filter.onDeploymentClick) {
              filter.onDeploymentClick(deployment);
            }
          }}
          style={{
            padding: 0,
            border: 'none',
            background: 'none'
          }}
        >
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
                    <Text size="2" color="gray600">
                      {deployment.description.slice(0, 60)}
                      {deployment.description.length > 60 ? '...' : ''}
                    </Text>
                  )
                }
              />

              <Entity.Field
                title={<Text size="2">{deployment.server.name}</Text>}
                value={<RenderDate date={deployment.createdAt} />}
              />
            </Entity.Content>
          </Entity.Wrapper>
        </button>
      ))}

      {deployments.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No deployments found
        </Text>
      )}
    </>
  ));
};
