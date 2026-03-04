import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useMagicMcpServer, useMagicMcpTokens } from '@metorial/state';
import { Attributes, Button, Copy, RenderDate, Spacer, Tabs, useCopy } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ConnectionType, connectionTypes } from '../components/connection';

export let MagicMcpServerOverviewPage = () => {
  let instance = useCurrentInstance();
  let { magicMcpServerId } = useParams();

  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);
  let tokens = useMagicMcpTokens(instance.data?.id, {
    status: 'active'
  });

  let [tab, setTab] = useState<ConnectionType>('cursor');
  let copy = useCopy();

  return renderWithLoader({ server, tokens })(({ server, tokens }) => {
    let streamableHttpUrl = server.data.endpoints[0]?.url;
    let activeToken = tokens.data.items.find(
      t => t.status === 'active' && t.groups.length === 0
    );
    let fullUrl =
      streamableHttpUrl && activeToken
        ? `${streamableHttpUrl}?key=${activeToken.secret}`
        : null;
    let connection = activeToken
      ? connectionTypes[tab].getConnection(server.data, activeToken)
      : null;
    let hasRestrictedActiveToken = tokens.data.items.some(
      token => token.status === 'active' && token.groups.length > 0
    );

    return (
      <>
        <Attributes
          itemWidth="250px"
          attributes={[
            {
              label: 'Name',
              content: server.data.name
            },
            {
              label: 'ID',
              content: <ID id={server.data.id} />
            },
            {
              label: 'Session Template',
              content: <ID id={server.data.sessionTemplateId} />
            },
            {
              label: 'Created At',
              content: <RenderDate date={server.data.createdAt} />
            }
          ]}
        />

        <Spacer height={15} />

        <Box
          title={`Connect to ${server.data.name ?? 'Magic MCP Server'}`}
          description="Use this Magic MCP endpoint to connect to your server."
        >
          <Copy
            label="Endpoint"
            value={streamableHttpUrl ?? '...'}
            copyValue={streamableHttpUrl ?? ''}
          />

          <Spacer height={15} />

          {activeToken ? (
            <>
              <Copy
                label="Endpoint with key"
                value={fullUrl ?? '...'}
                copyValue={fullUrl ?? ''}
              />

              <Spacer height={15} />

              <Tabs
                current={tab}
                action={setTab as any}
                tabs={Object.entries(connectionTypes).map(([id, value]) => ({
                  id,
                  label: value.name
                }))}
              />

              {connection && (
                <>
                  {connection.steps.map((step, idx) => (
                    <div key={idx}>
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
                    </div>
                  ))}

                  {'config' in connection && connection.config && (
                    <>
                      <Spacer height={10} />
                      <CodeBlock
                        language="json"
                        code={JSON.stringify(connection.config, null, 2)}
                        lineNumbers={false}
                      />
                      <Spacer height={5} />
                      <Button
                        variant="outline"
                        size="1"
                        onClick={() => copy.copy(JSON.stringify(connection.config, null, 2))}
                        success={copy.copied}
                      >
                        Copy configuration
                      </Button>
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <p>
                {hasRestrictedActiveToken
                  ? 'No unrestricted Magic MCP token found. Create a token without group restrictions to generate a guaranteed working connection snippet.'
                  : 'No active Magic MCP token found. Create one to connect clients.'}
              </p>
              <Link
                to={Paths.instance.magicMcp.tokens(
                  instance.data?.organization,
                  instance.data?.project,
                  instance.data
                )}
              >
                <Button as="span" size="1">
                  Open Tokens
                </Button>
              </Link>
            </>
          )}
        </Box>
      </>
    );
  });
};
