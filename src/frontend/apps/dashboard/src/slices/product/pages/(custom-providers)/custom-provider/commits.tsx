import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
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

export let CustomProviderCommitsPage = () => {
  let instance = useCurrentInstance();

  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);
  let deployments = useCustomProviderDeployments(instance.data?.id, customProvider.data?.id, {
    order: 'desc'
  });

  let deploymentsContent = renderWithPagination(deployments)(deployments => (
    <>
      <Table
        headers={['Status', 'Message', 'Trigger', 'Actor', 'Created']}
        data={deployments.data.items.map(deployment => ({
          data: [
            <DeploymentStatusBadge status={deployment.status} />,
            <Text size="2">
              {deployment.commit?.message ?? <span style={{ opacity: 0.5 }}>--</span>}
            </Text>,
            <Text size="2">{deployment.trigger ?? 'manual'}</Text>,
            <Text size="2">{deployment.actor?.name ?? 'System'}</Text>,
            <RenderDate date={deployment.createdAt} />
          ]
        }))}
      />

      {deployments.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No commits found.
        </Text>
      )}
    </>
  ));

  return renderWithLoader({ customProvider })(() => <>{deploymentsContent}</>);
};
