import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useIntegrations,
  useMagicMcpServers,
  useProvider,
  useProviderListing
} from '@metorial/state';
import { Attributes, Button, Spacer, Text } from '@metorial/ui';
import { Box, ID, SideBox, Table } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { Skills } from './components/skills';

let Header = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
`;

export let ProviderOverviewPage = () => {
  let instance = useCurrentInstance();

  let { providerId } = useParams();
  let provider = useProvider(instance.data?.id, providerId);

  let listing = useProviderListing(instance.data?.id, providerId);
  let providerFilterQuery = providerId ? `?providerId=${encodeURIComponent(providerId)}` : '';
  let integrations = useIntegrations(
    instance.data?.id && providerId ? instance.data.id : null,
    {
      providerId,
      status: ['active'],
      limit: 3
    }
  );
  let magicMcpServers = useMagicMcpServers(
    instance.data?.id && providerId ? instance.data.id : null,
    {
      providerId,
      status: ['active'],
      limit: 3
    }
  );

  return renderWithLoader({ provider })(({ provider }) => (
    <>
      <Header>
        <Attributes
          itemWidth="200px"
          attributes={[
            {
              label: 'Identifier',
              content: <ID id={listing.data?.slug ?? provider.data.slug} />
            },
            {
              label: 'Publisher',
              content: provider.data.publisher.name
            }
          ]}
        />

        <SideBox
          title="Test this provider"
          description="Use the Metorial Explorer to test this provider."
        >
          <Link
            to={Paths.instance.explorer(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              { provider_id: provider.data?.id }
            )}
          >
            <Button as="span" size="2">
              Open Explorer
            </Button>
          </Link>
        </SideBox>
      </Header>

      <Spacer height={15} />

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
          <Link
            to={`${Paths.instance.integrations(
              instance.data?.organization,
              instance.data?.project,
              instance.data
            )}${providerFilterQuery}`}
          >
            <Button as="span" size="1" variant="outline">
              View All
            </Button>
          </Link>
        }
      >
        {integrations.isLoading ? (
          <Text size="2" color="gray600">
            Loading integrations...
          </Text>
        ) : integrations.data?.items.length ? (
          <Table
            headers={['Name', 'Status', 'ID']}
            data={integrations.data.items.map(integration => ({
              href: Paths.instance.integration(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                integration.id
              ),
              data: [
                <Text size="2" weight="strong">
                  {integration.name}
                </Text>,
                <Text size="2">{integration.status}</Text>,
                <Text size="2">
                  <ID id={integration.id} />
                </Text>
              ]
            }))}
          />
        ) : (
          <Text size="2" color="gray600">
            No integrations found for this provider.
          </Text>
        )}
      </Box>

      <Spacer height={15} />

      <Box
        title="Magic MCP Servers"
        description="Magic MCP servers that include this provider."
        rightActions={
          <Link
            to={`${Paths.instance.magicMcp.servers(
              instance.data?.organization,
              instance.data?.project,
              instance.data
            )}${providerFilterQuery}`}
          >
            <Button as="span" size="1" variant="outline">
              View All
            </Button>
          </Link>
        }
      >
        {magicMcpServers.isLoading ? (
          <Text size="2" color="gray600">
            Loading Magic MCP servers...
          </Text>
        ) : magicMcpServers.data?.items.length ? (
          <Table
            headers={['Name', 'Alias', 'Status', 'ID']}
            data={magicMcpServers.data.items.map(server => ({
              href: Paths.instance.magicMcp.server(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                server.id
              ),
              data: [
                <Text size="2" weight="strong">
                  {server.name ?? 'Unknown Server'}
                </Text>,
                <Text size="2">{server.endpoints[0]?.alias ?? '-'}</Text>,
                <Text size="2">{server.status}</Text>,
                <Text size="2">
                  <ID id={server.id} />
                </Text>
              ]
            }))}
          />
        ) : (
          <Text size="2" color="gray600">
            No Magic MCP servers found for this provider.
          </Text>
        )}
      </Box>
    </>
  ));
};
