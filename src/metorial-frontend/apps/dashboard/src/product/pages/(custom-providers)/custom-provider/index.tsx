import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  DashboardInstanceCustomProvidersGetOutput,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useCustomProvider
} from '@metorial/state';
import { Entity, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { OpenExplorerBox } from '../../../components/openExplorer';
import { getCustomProviderScmLink } from '../../../scenes/customProvider/utils';
import { UsageOverviewTiles } from '../../../scenes/instanceUsage';
import { SecurityAssessmentCard } from '../../../scenes/securityReview';
import { CustomProviderVersionsTable } from '../../../scenes/customProvider/versions';

let RecentVersionsBox = (p: { customProvider: DashboardInstanceCustomProvidersGetOutput }) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return (
    <Box title="Versions" description="The most recently published versions of this provider.">
      <CustomProviderVersionsTable
        customProvider={p.customProvider}
        listVariant="preview"
        listLimit={5}
        emptyState="No versions found for this provider."
        viewAllHref={Paths.instance.customProvider(
          organization.data,
          project.data,
          instance.data,
          p.customProvider.id,
          'versions'
        )}
      />
    </Box>
  );
};

export let CustomProviderOverviewPage = () => {
  let instance = useCurrentInstance();

  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);

  return renderWithLoader({ customProvider })(({ customProvider }) => {
    let scmLink = getCustomProviderScmLink(customProvider.data);
    let remoteMcpServer = customProvider.data.draft.remoteMcpServer;

    return (
      <DetailsOverviewLayout>
        <OpenExplorerBox
          title="Test Provider"
          description="Use the Metorial Explorer to test your custom provider."
          buttonLabel="Test Provider"
          disabled={!customProvider.data.provider?.id}
          to={Paths.instance.explorer(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            { provider_id: customProvider.data.provider?.id }
          )}
        />

        <Spacer height={15} />

        {remoteMcpServer?.url && (
          <>
            <Entity.Wrapper header="Remote MCP Server">
              <Entity.Content>
                <Entity.Field title={remoteMcpServer.url} />
              </Entity.Content>
            </Entity.Wrapper>

            <Spacer height={15} />
          </>
        )}

        {scmLink?.repositoryUrl && (
          <>
            <Entity.Wrapper header="Repository URL">
              <Entity.Content>
                <Entity.Field
                  title={
                    <a href={scmLink.repositoryUrl} target="_blank" rel="noreferrer">
                      {scmLink.repositoryUrl}
                    </a>
                  }
                />
              </Entity.Content>
            </Entity.Wrapper>

            <Spacer height={15} />
          </>
        )}

        {customProvider.data.provider?.id ? (
          <>
            <UsageOverviewTiles
              filter={{ providerId: customProvider.data.provider.id }}
              tiles={['tool_calls', 'error_rate', 'sessions']}
              href={Paths.instance.provider(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                customProvider.data.provider.id,
                'usage'
              )}
            />

            <Spacer height={15} />

            <SecurityAssessmentCard
              instanceId={instance.data?.id}
              providerId={customProvider.data.provider.id}
              reportHref={Paths.instance.provider(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                customProvider.data.provider.id,
                'security'
              )}
            />
          </>
        ) : null}

        <RecentVersionsBox customProvider={customProvider.data} />
      </DetailsOverviewLayout>
    );
  });
};
