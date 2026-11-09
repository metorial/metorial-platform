import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  IntegrationPreview,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegration
} from '@metorial/state';
import { Button, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { UsageOverviewTiles } from '../../../scenes/instanceUsage';
import { IntegrationInstancesTable } from '../../../scenes/integrations/instancesTable';
import { IntegrationAdminSetupCallouts } from '../../../scenes/integrations/adminSetupCallout';
import { showIntegrationProviderPanelFlow } from '../../../scenes/integrations/providerPanelFlow';
import { IntegrationProvidersManager } from '../../../scenes/integrations/providersManager';
import { SecurityAssessmentCard } from '../../../scenes/securityReview';

let RecentInstancesBox = (p: { instanceId: string; integration: IntegrationPreview }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  return (
    <Box title="Instances" description="Recently created instances of this integration.">
      <IntegrationInstancesTable
        instanceId={p.instanceId}
        integration={p.integration}
        listVariant="preview"
        listLayout="table"
        listLimit={5}
        viewAllHref={Paths.instance.integration(
          organization.data,
          project.data,
          instance.data,
          p.integration.id,
          'instances'
        )}
      />
    </Box>
  );
};

export let IntegrationOverviewPage = () => {
  let instance = useCurrentInstance();
  let { integrationId } = useParams();
  let integration = useIntegration(instance.data?.id, integrationId);

  return renderWithLoader({ integration })(({ integration }) => {
    let onComplete = () => integration.refetch();

    let activeProviders = (integration.data.providers ?? []).filter(
      provider => provider.status == 'active'
    );
    let providerIds = [...new Set(activeProviders.map(provider => provider.providerId))];
    let providerNames = Object.fromEntries(
      activeProviders.map(provider => [provider.providerId, provider.name])
    );

    return (
      <DetailsOverviewLayout>
        {integration.data.status === 'active' ? (
          <IntegrationAdminSetupCallouts
            instanceId={instance.data!.id}
            integration={integration.data}
          />
        ) : null}

        <UsageOverviewTiles
          filter={{ integrationId: integration.data.id }}
          tiles={['tool_calls', 'sessions', 'active_consumers', 'errors']}
          href={Paths.instance.integration(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            integration.data.id,
            'usage'
          )}
        />

        <Spacer height={20} />

        {providerIds.map(providerId => (
          <SecurityAssessmentCard
            key={providerId}
            instanceId={instance.data?.id}
            providerId={providerId}
            title={
              providerIds.length > 1
                ? `Security Assessment · ${providerNames[providerId] ?? 'Provider'}`
                : 'Security Assessment'
            }
            reportHref={Paths.instance.provider(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              providerId,
              'security'
            )}
            spacing={20}
          />
        ))}

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
