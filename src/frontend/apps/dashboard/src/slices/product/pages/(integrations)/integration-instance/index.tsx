import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useIntegration, useIntegrationInstance } from '@metorial/state';
import { Attributes, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { IntegrationInstanceProvidersManager } from '../../../scenes/integrations/providersManager';

export let IntegrationInstanceOverviewPage = () => {
  let instance = useCurrentInstance();
  let { integrationInstanceId } = useParams();
  let integrationInstance = useIntegrationInstance(instance.data?.id, integrationInstanceId);
  let integration = useIntegration(instance.data?.id, integrationInstance.data?.integrationId);

  return renderWithLoader({ integrationInstance, integration })(
    ({ integrationInstance, integration }) => (
      <>
        <Attributes
          itemWidth="360px"
          attributes={[
            { label: 'ID', content: <ID id={integrationInstance.data.id} /> },
            { label: 'Status', content: integrationInstance.data.status },
            {
              label: 'Identity',
              content: integrationInstance.data.identityId ? (
                <ID id={integrationInstance.data.identityId} />
              ) : (
                '-'
              )
            }
          ]}
        />

        <Spacer height={20} />

        <Box
          title="Providers"
          description="Configure effective provider settings for this integration instance."
        >
          <IntegrationInstanceProvidersManager
            instanceId={instance.data!.id}
            integration={integration.data}
            integrationInstance={integrationInstance.data}
          />
        </Box>
      </>
    )
  );
};
