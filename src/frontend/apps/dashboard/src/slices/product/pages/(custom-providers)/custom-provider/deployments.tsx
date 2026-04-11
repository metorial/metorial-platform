import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useCustomProvider,
  useCustomProviderDeployments
} from '@metorial/state';
import { useParams } from 'react-router-dom';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';

export let CustomProviderProviderDeploymentsPage = () => {
  let instance = useCurrentInstance();
  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);
  let deployments = useCustomProviderDeployments(instance.data?.id, customProvider.data?.id, {
    order: 'desc'
  });

  let deploymentsContent = renderWithPagination(deployments)(deployments => (
    <>
      <Table
        headers={['Status', 'Version', 'Trigger', 'Source', 'Actor', 'Created']}
        data={deployments.data.items.map(deployment => ({
          data: [
            <Badge
              color={
                deployment.status === 'succeeded'
                  ? 'green'
                  : deployment.status === 'failed'
                    ? 'red'
                    : 'orange'
              }
            >
              {deployment.status}
            </Badge>,
            deployment.customProviderVersionId ? (
              <ID color="gray">{deployment.customProviderVersionId}</ID>
            ) : (
              <Text size="2" color="gray600">
                --
              </Text>
            ),
            <Text size="2">{deployment.trigger ?? 'manual'}</Text>,
            deployment.scmPush ? (
              <Text size="2">
                {deployment.scmPush.commit.branch}@{deployment.scmPush.commit.sha.substring(0, 7)}
              </Text>
            ) : deployment.commit?.message ? (
              <Text size="2">{deployment.commit.message}</Text>
            ) : (
              <Text size="2" color="gray600">
                Manual
              </Text>
            ),
            <Text size="2">{deployment.actor?.name ?? 'System'}</Text>,
            <RenderDate date={deployment.createdAt} />
          ]
        }))}
      />

      {deployments.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No deployments found.
        </Text>
      )}
    </>
  ));

  return renderWithLoader({ instance, customProvider })(() => (
    <ProviderDeploymentTabSection>
      {deploymentsContent}
    </ProviderDeploymentTabSection>
  ));
};
