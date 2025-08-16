import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ServersDeploymentsGetOutput } from '@metorial/generated';
import { ServersDeploymentsListQuery } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { useCurrentInstance, useServerDeployments } from '@metorial/state';
import { Entity, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { Link } from 'react-router-dom';

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
          No deployments found.
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
    <ServerDeploymentsListItems
      deployments={deployments.data.items}
      onDeploymentClick={filter.onDeploymentClick as any}
    />
  ));
};

export interface ServerDeployment {
  id: string;
  name: string | null;
  description: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  server: {
    object: 'server#preview';
    id: string;
    name: string;
    description: string | null;
    type: 'public' | 'custom';
    createdAt: Date;
    updatedAt: Date;
  };
}

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
                title={<Text size="2">{deployment.server.name}</Text>}
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
            to={Paths.instance.serverDeployment(
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
