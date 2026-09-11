import { renderWithLoader } from '@metorial/data-hooks';
import { PageHeaderSection } from '@metorial/layout';
import { useCurrentInstance, useIntegration } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { IntegrationInstancesTable } from '../../../scenes/integrations/instancesTable';

export let IntegrationInstancesPage = () => {
  let instance = useCurrentInstance();
  let { integrationId } = useParams();
  let integration = useIntegration(instance.data?.id, integrationId);

  return renderWithLoader({ integration })(({ integration }) => (
    <PageHeaderSection
      title="Instances"
      description="Instances are individual deployments of this integration. Each instance has its own configuration and authentication settings."
    >
      <IntegrationInstancesTable
        instanceId={instance.data!.id}
        integration={integration.data}
      />
    </PageHeaderSection>
  ));
};
