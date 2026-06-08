import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useIntegration } from '@metorial/state';
import { Attributes, Button, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { IntegrationProvidersManager } from '../../../scenes/integrations/providersManager';
import { showIntegrationProviderPanelFlow } from '../../../scenes/integrations/providerPanelFlow';

export let IntegrationOverviewPage = () => {
  let instance = useCurrentInstance();
  let { integrationId } = useParams();
  let integration = useIntegration(instance.data?.id, integrationId);

  return renderWithLoader({ integration })(({ integration }) => {
    let onComplete = () => integration.refetch();

    return (
      <>
        <Attributes
          itemWidth="360px"
          attributes={[
            { label: 'ID', content: <ID id={integration.data.id} /> },
            { label: 'Status', content: integration.data.status },
            { label: 'Slug', content: integration.data.slug ?? '-' }
          ]}
        />

        <Spacer height={20} />

        <Box
          title="Providers"
          description="Choose which providers are connected to this integration and manage their configuration and authentication settings."
          rightActions={
            <Button
              size="2"
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
      </>
    );
  });
};
