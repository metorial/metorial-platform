import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCustomProvider,
  useCustomProviderDeployments
} from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

let DeploymentStatusBadge = ({ status }: { status: string | null }) =>
  (
    ({
      queued: <Badge color="orange">Queued</Badge>,
      deploying: <Badge color="orange">Deploying</Badge>,
      succeeded: <Badge color="green">Succeeded</Badge>,
      deployed: <Badge color="green">Succeeded</Badge>,
      completed: <Badge color="green">Succeeded</Badge>,
      failed: <Badge color="red">Failed</Badge>,
      deployment_failed: <Badge color="red">Failed</Badge>
    }) as Record<string, React.ReactElement>
  )[status ?? ''] ?? <Badge color="gray">{status ?? 'Unknown'}</Badge>;

export let CustomProviderDeploymentsPage = () => {
  let instance = useCurrentInstance();

  let { customServerId } = useParams();
  let customServer = useCustomProvider(instance.data?.id, customServerId);
  let deployments = useCustomProviderDeployments(instance.data?.id, customServer.data?.id, {
    order: 'desc'
  });

  return renderWithLoader({ customServer })(() => (
    <>
      {renderWithPagination(deployments)(deployments => (
        <>
          <Table
            headers={['Status', 'Trigger', 'Commit', 'Actor', 'Created']}
            data={deployments.data.items.map(deployment => ({
              data: [
                <DeploymentStatusBadge status={deployment.status} />,
                <Text size="2">{deployment.trigger ?? 'manual'}</Text>,
                <Text size="2">
                  {deployment.commit?.message ?? <span style={{ opacity: 0.5 }}>--</span>}
                </Text>,
                <Text size="2">{deployment.actor?.name ?? 'System'}</Text>,
                <RenderDate date={deployment.createdAt} />
              ],
              href: deployment.customProviderVersionId
                ? Paths.instance.customServer(
                    instance.data?.organization,
                    instance.data?.project,
                    instance.data,
                    customServer.data?.id,
                    'versions',
                    { version_id: deployment.customProviderVersionId }
                  )
                : undefined
            }))}
          />

          {deployments.data.items.length === 0 && (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No deployments found.
            </Text>
          )}
        </>
      ))}
    </>
  ));
};
