import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useIntegration } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { IntegrationInstancesTable } from '../../../scenes/integrations/instancesTable';

export let IntegrationInstancesPage = () => {
  let instance = useCurrentInstance();
  let { integrationId } = useParams();
  let integration = useIntegration(instance.data?.id, integrationId);

  return renderWithLoader({ integration })(({ integration }) => (
    <IntegrationInstancesTable instanceId={instance.data!.id} integration={integration.data} />
  ));
};
