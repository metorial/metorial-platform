import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useIntegration, useIntegrationProviders } from '@metorial/state';
import { Attributes, Button, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { showIntegrationProviderPanelFlow } from '../../../scenes/integrations/providerPanelFlow';
import { IntegrationProvidersManager } from '../../../scenes/integrations/providersManager';

export let IntegrationOverviewPage = () => {
  let instance = useCurrentInstance();
  let { integrationId } = useParams();
  let integration = useIntegration(instance.data?.id, integrationId);
  let providers = useIntegrationProviders(instance.data?.id, { integrationId });

  return renderWithLoader({ integration })(({ integration }) => (
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
        description="Providers define the shared deployment, config, auth, and tool contract for this integration."
        rightActions={
          <Button
            size="2"
            onClick={() =>
              showIntegrationProviderPanelFlow({
                integration: integration.data,
                onComplete: () => {
                  integration.refetch();
                  providers.refetch();
                }
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
        />
      </Box>
    </>
  ));
};
