import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useMagicMcpServer, useMagicMcpTokens } from '@metorial/state';
import {
  Attributes,
  Button,
  Copy,
  RenderDate,
  Spacer,
  Tabs,
  theme,
  useCopy
} from '@metorial/ui';
import { Box, ID, SideBox } from '@metorial/ui-product';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { UsageScene } from '../../../scenes/usage/usage';
import { ConnectionType, connectionTypes } from '../components/connection';
import { MagicMcpServerOauthCallout } from './oauth';

let List = styled.ol`
  margin: 0;
  padding-left: 20px;
  list-style: decimal;
  font-size: 14px;
  font-weight: 500;
  color: ${theme.colors.gray700};

  li {
    margin-bottom: 10px;
  }
`;

export let MagicMcpServerOverviewPage = () => {
  let instance = useCurrentInstance();

  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);
  let serverDeployment = server.data?.serverDeployments[0];

  let tokens = useMagicMcpTokens(instance.data?.id, {
    status: 'active'
  });

  let token = tokens.data?.items?.[0];
  let secret = token?.secret;

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

  let [tabs, setTabs] = useState<ConnectionType>('cursor');
  let currentTab = connectionTypes[tabs];
  let currentTabConnection =
    server.data && token ? currentTab.getConnection(server.data, token) : null;

  let copy = useCopy();

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

        <Spacer height={15} />

        <Tabs
          current={tabs}
          action={setTabs as any}
          tabs={Object.entries(connectionTypes).map(([key, value]) => ({
            id: key,
            label: value.name
          }))}
        />

        {currentTabConnection && (
          <>
            <List>
              {currentTabConnection.steps.map((step, i) => (
                <li key={i}>
                  <p>{step.text}</p>

                  {'command' in step && step.command && (
                    <>
                      <CodeBlock code={step.command} lineNumbers={false} />
                      <Spacer height={5} />
                      <Button
                        variant="outline"
                        size="1"
                        onClick={() => copy.copy(step.command!)}
                        success={copy.copied}
                      >
                        Copy command
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </List>

            {'config' in currentTabConnection && currentTabConnection.config && (
              <>
                <CodeBlock
                  language="json"
                  code={JSON.stringify(currentTabConnection.config, null, 2)}
                  lineNumbers={false}
                />
                <Spacer height={5} />
                <Button
                  variant="outline"
                  size="1"
                  onClick={() =>
                    copy.copy(JSON.stringify(currentTabConnection.config, null, 2))
                  }
                  success={copy.copied}
                >
                  Copy configuration
                </Button>
              </>
            )}
          </>
        )}
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
