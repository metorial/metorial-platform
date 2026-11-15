import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProvider, useProviderListing } from '@metorial/state';
import { Button, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { OpenExplorerBox } from '../../components/openExplorer';
import { UsageOverviewTiles } from '../../scenes/instanceUsage';
import { IntegrationsGrid } from '../../scenes/integrations/grid';
import { MagicMcpServersTable } from '../../scenes/magicMcp/serversGrid';
import { showCreateIntegrationProviderFirstFlow } from '../../scenes/integrations/providerPanelFlow';
import { showMagicMcpServerCreateFlow } from '../../scenes/providerDeployments/magicMcpForm';
import { SecurityAssessmentCard } from '@metorial/scene-skills';
import { Skills } from './components/skills';

export let ProviderOverviewPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  let { providerId } = useParams();
  let provider = useProvider(instance.data?.id, providerId);

  let listing = useProviderListing(instance.data?.id, providerId);
  let providerFilterQuery = providerId
    ? `?providerId=${encodeURIComponent(provider.data?.id ?? providerId)}`
    : '';

  return renderWithLoader({ provider })(({ provider }) => (
    <DetailsOverviewLayout>
      <OpenExplorerBox
        title="Test this provider"
        description="Use the Metorial Explorer to test this provider."
        to={Paths.instance.explorer(
          instance.data?.organization,
          instance.data?.project,
          instance.data,
          { provider_id: provider.data?.id }
        )}
      />

      <Spacer height={15} />

      <UsageOverviewTiles
        filter={{ providerId: provider.data.id }}
        tiles={['tool_calls', 'error_rate', 'sessions']}
        href={Paths.instance.provider(
          instance.data?.organization,
          instance.data?.project,
          instance.data,
          provider.data.slug,
          'usage'
        )}
      />

      <Spacer height={15} />

      <SecurityAssessmentCard
        instanceId={instance.data?.id}
        providerId={provider.data.id}
        reportHref={Paths.instance.provider(
          instance.data?.organization,
          instance.data?.project,
          instance.data,
          provider.data.slug,
          'security'
        )}
      />

      {listing.data?.skills && listing.data.skills.length > 0 && (
        <>
          <Skills skills={listing.data.skills} />
          <Spacer height={15} />
        </>
      )}

      <Box
        title="Integrations"
        description="Integrations that include this provider."
        rightActions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="1"
              onClick={() =>
                providerId &&
                showCreateIntegrationProviderFirstFlow({
                  providerId,
                  onCreate: integration => {
                    navigate(
                      Paths.instance.integration(
                        instance.data?.organization,
                        instance.data?.project,
                        instance.data,
                        integration.id
                      )
                    );
                  }
                })
              }
            >
              Create Integration
            </Button>
          </div>
        }
      >
        <IntegrationsGrid
          filters={{
            providerId: [provider.data.id],
            status: ['active'],
            order: 'desc'
          }}
          listVariant="preview"
          listLayout="table"
          listLimit={15}
          emptyState="No integrations found for this provider."
          viewAllHref={`${Paths.instance.integrations(
            instance.data?.organization,
            instance.data?.project,
            instance.data
          )}${providerFilterQuery}`}
        />
      </Box>

      <Spacer height={15} />

      <Box
        title="Magic MCP Servers"
        description="Magic MCP servers that include this provider."
        rightActions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="1"
              onClick={() =>
                instance.data &&
                providerId &&
                showMagicMcpServerCreateFlow({
                  instanceId: instance.data.id,
                  providerId
                })
              }
            >
              Create Magic MCP Server
            </Button>
          </div>
        }
      >
        <MagicMcpServersTable
          providerId={[provider.data.id]}
          status={['active']}
          listVariant="preview"
          listLimit={15}
          emptyState="No Magic MCP servers found for this provider."
          viewAllHref={`${Paths.instance.magicMcp.servers(
            instance.data?.organization,
            instance.data?.project,
            instance.data
          )}${providerFilterQuery}`}
        />
      </Box>
    </DetailsOverviewLayout>
  ));
};
