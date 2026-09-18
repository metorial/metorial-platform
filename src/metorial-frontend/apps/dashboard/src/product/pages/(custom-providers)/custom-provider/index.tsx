import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  DashboardInstanceCustomProvidersGetOutput,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useCustomProvider,
  useCustomProviderVersions
} from '@metorial/state';
import { Button, Entity, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { OpenExplorerBox } from '../../../components/openExplorer';
import { getCustomProviderScmLink } from '../../../scenes/customProvider/utils';
import { CustomProviderVersionStatus } from '../../../scenes/customProvider/version';

let RecentVersionsBox = (p: { customProvider: DashboardInstanceCustomProvidersGetOutput }) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let versions = useCustomProviderVersions(instance.data?.id, p.customProvider.id, {
    order: 'desc',
    limit: 5
  });

  return (
    <Box
      title="Versions"
      description="The most recently published versions of this provider."
      rightActions={
        <Link
          to={Paths.instance.customProvider(
            organization.data,
            project.data,
            instance.data,
            p.customProvider.id,
            'versions'
          )}
        >
          <Button as="span" size="1" variant="outline">
            View All
          </Button>
        </Link>
      }
    >
      {renderWithPagination(versions, { hidePaginationWhenUnavailable: true })(versions => (
        <>
          <Table
            headers={['Version', 'Status', 'Created']}
            data={versions.data.items.map(version => ({
              href: Paths.instance.customProvider(
                organization.data,
                project.data,
                instance.data,
                p.customProvider.id,
                'versions',
                { version_id: version.id }
              ),
              data: [
                <Text size="2" weight="strong">
                  {version.index}
                </Text>,
                <CustomProviderVersionStatus version={version} />,
                <RenderDate date={version.createdAt} />
              ]
            }))}
          />

          {versions.data.items.length === 0 ? (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No versions found for this provider.
            </Text>
          ) : null}
        </>
      ))}
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

        {/* <Spacer height={15} />

        <UsageScene
          title="Usage"
          description="See how this custom provider is being in your instance."
          entities={[{ type: 'provider', id: customProvider.data.provider?.id ?? 'xxxx' }]}
          entityNames={{
            [customProvider.data.provider?.id ?? 'xxxx']: customProvider.data.provider?.name!
          }}
        /> */}

        <RecentVersionsBox customProvider={customProvider.data} />
      </DetailsOverviewLayout>
    );
  });
};
