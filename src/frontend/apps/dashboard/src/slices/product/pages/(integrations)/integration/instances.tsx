import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegration,
  useIntegrationInstances
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IntegrationInstancesTable,
  showIntegrationInstanceFormModal
} from '../../../scenes/integrations/instancesTable';

export let IntegrationInstancesPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { integrationId } = useParams();
  let integration = useIntegration(instance.data?.id, integrationId);
  let instances = useIntegrationInstances(instance.data?.id, { integrationId });
  let navigate = useNavigate();

  return renderWithLoader({ integration })(({ integration }) => (
    <Box
      title="Instances"
      description="Instances materialize this integration for a concrete identity or runtime."
      rightActions={
        <Button
          size="2"
          onClick={() =>
            instance.data &&
            showIntegrationInstanceFormModal({
              instanceId: instance.data.id,
              integration: integration.data,
              onCreate: created => {
                instances.refetch();
                navigate(
                  Paths.instance.integrationInstance(
                    organization.data,
                    project.data,
                    instance.data,
                    created.id
                  )
                );
              }
            })
          }
        >
          Create Instance
        </Button>
      }
    >
      <IntegrationInstancesTable
        instanceId={instance.data!.id}
        integration={integration.data}
      />
    </Box>
  ));
};
