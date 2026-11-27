import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useIntegration } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ResourcePortalAccess } from '../../../scenes/portalShare';

export let IntegrationAccessPage = () => {
  let instance = useCurrentInstance();
  let { integrationId } = useParams();
  let integration = useIntegration(instance.data?.id, integrationId);

  return renderWithLoader({ instance, integration })(({ instance, integration }) => (
    <ResourcePortalAccess
      instanceId={instance.data.id}
      resource={{
        type: 'integration',
        id: integration.data.id,
        name: integration.data.name,
        description: integration.data.description
      }}
    />
  ));
};
