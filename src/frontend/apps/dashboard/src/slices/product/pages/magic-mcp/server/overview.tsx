import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useMagicMcpServer, useMagicMcpTokens } from '@metorial/state';
import { Attributes, Button, Copy, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID, SideBox } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { UsageScene } from '../../../scenes/usage/usage';
import { MagicMcpServerOauthCallout } from './oauth';

export let MagicMcpServerOverviewPage = () => {
  let instance = useCurrentInstance();

  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);
  let serverDeployment = server.data?.serverDeployments[0];

  let tokens = useMagicMcpTokens(instance.data?.id, {
    status: 'active'
  });

  let secret = tokens.data?.items?.[0]?.secret;

  let url = server.data?.endpoints[0]?.urls.streamableHttp;
  if (url && secret) {
    url += `?key=${secret}`;
  }

  let cleanUrl = server.data?.endpoints[0]?.urls.streamableHttp;
  if (url && secret) {
    let keyParts = secret.split('_');
    let secretPart = keyParts.pop()!;
    let cleanSecret =
      keyParts.join('_') + '_' + secretPart.slice(0, 4) + '...' + secretPart.slice(-4);
    cleanUrl += `?key=${cleanSecret}`;
  }

  return renderWithLoader({ server })(({ server }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: server.data.name
          },
          {
            label: 'Server',
            content: serverDeployment?.server.name ?? '...'
          },
          {
            label: 'ID',
            content: <ID id={server.data.id} />
          },
          {
            label: 'Created At',
            content: <RenderDate date={server.data.createdAt!} />
          }
        ]}
      />

      <Spacer height={15} />

      <MagicMcpServerOauthCallout />

      <Spacer height={15} />

      <SideBox
        title="Test your Magic MCP server"
        description="Use the Metorial Explorer to test your Magic MCP server."
      >
        <Link
          to={Paths.instance.explorer(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            { server_deployment_id: server.data.serverDeployments[0]?.id }
          )}
        >
          <Button as="span" size="2">
            Open Explorer
          </Button>
        </Link>
      </SideBox>

      <Spacer height={15} />

      <Box
        title={`Connect to ${server.data.name}`}
        description="Use this Magic MCP endpoint to connect to your server."
      >
        <Copy label="Endpoint" value={cleanUrl ?? '...'} copyValue={url ?? ''} />
      </Box>

      <Spacer height={15} />

      {serverDeployment && (
        <UsageScene
          title="Usage"
          description="See how this Magic MCP server is being used in your project."
          entities={[{ type: 'server_deployment', id: serverDeployment.id }]}
          entityNames={{ [serverDeployment.id]: serverDeployment.name! }}
        />
      )}
    </>
  ));
};
