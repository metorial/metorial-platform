import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { usePaths } from '../../../../state/portal/path';
import {
  Attributes,
  Badge,
  Button,
  Copy,
  Flex,
  RenderDate,
  Spacer,
  Tabs,
  Text,
  useCopy
} from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { useMagicMcpServer } from '../../../../state/consumer/magicMcpServer';
import { useMagicMcpTokens } from '../../../../state/consumer/magicMcpToken';
import { ConnectionType, connectionTypes } from '../components/connection';

let List = styled.ol`
  margin: 0;
  padding-left: 20px;
  list-style: decimal;
  font-size: 14px;
  font-weight: 500;
  color: var(--gray-700);

  li {
    margin-bottom: 10px;
  }
`;

export let MagicMcpProviderOverviewPage = () => {
  let { magicMcpServerId } = useParams();
  let paths = usePaths();
  let server = useMagicMcpServer(magicMcpServerId);
  let tokens = useMagicMcpTokens({
    status: 'active'
  });

  let [tab, setTab] = useState<ConnectionType>('cursor');
  let copy = useCopy();

  return renderWithLoader({ server, tokens })(({ server, tokens }) => {
    let activeToken = tokens.data.items.find(
      token => token.status === 'active' && token.groups.length === 0
    );
    let primaryEndpoint = server.data.endpoints[0]?.url ?? null;
    let maskedToken = activeToken?.secret
      ? `${activeToken.secret.slice(0, 8)}...${activeToken.secret.slice(-4)}`
      : null;
    let endpointWithKey =
      primaryEndpoint && activeToken?.secret
        ? `${primaryEndpoint}?key=${activeToken.secret}`
        : null;
    let maskedEndpointWithKey =
      primaryEndpoint && maskedToken ? `${primaryEndpoint}?key=${maskedToken}` : primaryEndpoint;
    let connection =
      primaryEndpoint && activeToken
        ? connectionTypes[tab].getConnection(server.data, activeToken)
        : null;
    let hasRestrictedTokens = tokens.data.items.some(
      token => token.status === 'active' && token.groups.length > 0
    );

    return (
      <>
        <Box
          title={
            <Flex gap={8} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{server.data.name ?? 'Magic MCP Server'}</span>
              <Badge
                color={
                  {
                    active: 'green' as const,
                    archived: 'orange' as const,
                    deleted: 'gray' as const
                  }[server.data.status] ?? 'gray'
                }
              >
                {server.data.status}
              </Badge>
              {server.data.endpoints.map(endpoint => (
                <Badge key={endpoint.id} color="gray" size="1">
                  {endpoint.alias}
                </Badge>
              ))}
            </Flex>
          }
          description="Key metadata for this Magic MCP server and its consumer endpoint."
        >
          <Attributes
            itemWidth="250px"
            attributes={[
              {
                label: 'ID',
                content: <ID id={server.data.id} />
              },
              {
                label: 'Session Template ID',
                content: <ID id={server.data.sessionTemplateId} />
              },
              {
                label: 'Provider Template ID',
                content: server.data.providerTemplateId ? (
                  <ID id={server.data.providerTemplateId} />
                ) : (
                  '-'
                )
              },
              {
                label: 'Created At',
                content: <RenderDate date={server.data.createdAt} />
              },
              {
                label: 'Updated At',
                content: <RenderDate date={server.data.updatedAt} />
              }
            ]}
          />

          <Spacer height={15} />

          <Copy
            label="Primary Endpoint"
            value={primaryEndpoint ?? 'No endpoint available yet'}
            copyValue={primaryEndpoint ?? ''}
          />
        </Box>

        <Spacer height={15} />

        <Box
          title={`Connect to ${server.data.name ?? 'this server'}`}
          description="Use a full-access Magic MCP token to configure your client."
        >
          {!primaryEndpoint ? (
            <Text size="2" color="gray600">
              This server does not expose an endpoint yet.
            </Text>
          ) : !activeToken ? (
            <Flex direction="column" gap={12}>
              <Text size="2" color="gray600">
                No active unrestricted Magic MCP token is available for connection setup.
              </Text>
              {hasRestrictedTokens ? (
                <Text size="2" color="gray600">
                  Existing active tokens are group-scoped. Create a full-access token if you
                  want a generic connection snippet for this server.
                </Text>
              ) : null}
              <Link to={paths.magicMcpTokens()}>
                <Button as="span" size="1" variant="outline">
                  Manage Tokens
                </Button>
              </Link>
            </Flex>
          ) : (
            <>
              <Copy
                label="Endpoint"
                value={maskedEndpointWithKey ?? '...'}
                copyValue={endpointWithKey ?? ''}
              />

              <Spacer height={15} />

              <Tabs
                current={tab}
                action={setTab as any}
                tabs={Object.entries(connectionTypes).map(([key, value]) => ({
                  id: key,
                  label: value.name
                }))}
              />

              {connection ? (
                <>
                  <List>
                    {connection.steps.map((step, i) => (
                      <li key={i}>
                        <p>{step.text}</p>

                        {'command' in step && step.command ? (
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
                        ) : null}
                      </li>
                    ))}
                  </List>

                  {'config' in connection && connection.config ? (
                    <>
                      <CodeBlock
                        language="json"
                        code={JSON.stringify(connection.config, null, 2)}
                        lineNumbers={false}
                      />
                      <Spacer height={5} />
                      <Button
                        variant="outline"
                        size="1"
                        onClick={() =>
                          copy.copy(JSON.stringify(connection.config, null, 2))
                        }
                        success={copy.copied}
                      >
                        Copy configuration
                      </Button>
                    </>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </Box>
      </>
    );
  });
};
