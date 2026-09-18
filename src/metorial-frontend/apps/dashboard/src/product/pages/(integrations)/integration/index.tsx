import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  IntegrationPreview,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegration,
  useIntegrationInstances
} from '@metorial/state';
import { Button, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { showIntegrationProviderPanelFlow } from '../../../scenes/integrations/providerPanelFlow';
import { IntegrationProvidersManager } from '../../../scenes/integrations/providersManager';

let getInstanceStatusColor = (status: string) => {
  if (status === 'active') return 'green';
  if (status === 'draft') return 'blue';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let RecentInstancesBox = (p: { instanceId: string; integration: IntegrationPreview }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let instances = useIntegrationInstances(p.instanceId, {
    integrationId: p.integration.id,
    order: 'desc',
    status: ['active'],
    limit: 5
  });

  return (
    <Box
      title="Instances"
      description="Recently created instances of this integration."
      rightActions={
        <Link
          to={Paths.instance.integration(
            organization.data,
            project.data,
            instance.data,
            p.integration.id,
            'instances'
          )}
        >
          <Button as="span" size="1" variant="outline">
            View All
          </Button>
        </Link>
      }
    >
      {renderWithPagination(instances, { hidePaginationWhenUnavailable: true })(instances => (
        <>
          <Table
            headers={['Name', 'Providers', 'Created']}
            data={instances.data.items.map(item => ({
              href: Paths.instance.integrationInstance(
                organization.data,
                project.data,
                instance.data,
                item.id
              ),
              data: [
                <Text size="2" weight="strong">
                  {item.name}
                </Text>,
                <Text size="2">{item.providers?.length ?? 0} providers</Text>,
                <RenderDate date={item.createdAt} />
              ]
            }))}
          />

          {instances.data.items.length === 0 ? (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No instances have been created for this integration yet.
            </Text>
          ) : null}
        </>
      ))}
    </Box>
  );
};

export let IntegrationOverviewPage = () => {
  let instance = useCurrentInstance();
  let { integrationId } = useParams();
  let integration = useIntegration(instance.data?.id, integrationId);

  return renderWithLoader({ integration })(({ integration }) => {
    let onComplete = () => integration.refetch();

    return (
      <DetailsOverviewLayout>
        <Box
          title="Providers"
          description="Choose which providers are connected to this integration and manage their configuration and authentication settings."
          rightActions={
            <Button
              size="1"
              onClick={() =>
                showIntegrationProviderPanelFlow({
                  integration: integration.data,
                  onComplete
                })
              }
            >
              Add Provider
            </Button>
          }
        >
          <IntegrationProvidersManager
            instanceId={instance.data!.id}
            integration={integration.data}
            onComplete={onComplete}
          />
        </Box>

        <Spacer height={20} />

        <RecentInstancesBox instanceId={instance.data!.id} integration={integration.data} />
      </DetailsOverviewLayout>
    );
  });
};
