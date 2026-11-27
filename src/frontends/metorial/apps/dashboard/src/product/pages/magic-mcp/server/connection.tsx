import { renderWithLoader } from '@metorial/data-hooks';
import { useMagicMcpTokens } from '@metorial/state';
import { Callout, Flex, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useEffect, useRef, useState } from 'react';
import { McpConnectionInstructionsScene } from '../../../scenes/mcpConnectionInstructions';

type ConnectionProps = {
  instanceId: string;
  server: { id: string; name: string | null; endpoints: { url: string }[] };
};

export let MagicMcpServerConnectionBox = (props: ConnectionProps & { canConnect: boolean }) =>
  props.canConnect ? (
    <MagicMcpServerConnectionContent
      key={`${props.instanceId}:${props.server.id}`}
      instanceId={props.instanceId}
      server={props.server}
    />
  ) : null;

let MagicMcpServerConnectionContent = ({ instanceId, server }: ConnectionProps) => {
  let tokens = useMagicMcpTokens(instanceId, {
    status: 'active',
    magicMcpServerId: server.id
  });
  let createToken = tokens.createMutator();
  let attemptedCreation = useRef(false);
  let [creatingToken, setCreatingToken] = useState(false);
  let [fallbackError, setFallbackError] = useState<string | null>(null);
  let [createdToken, setCreatedToken] = useState<{ id: string; secret: string } | null>(null);
  let existingToken = tokens.data?.items.find(
    token => token.status === 'active' && token.server?.id === server.id
  );

  useEffect(() => {
    if (
      tokens.error ||
      tokens.isLoading ||
      !tokens.data ||
      existingToken ||
      attemptedCreation.current
    )
      return;
    attemptedCreation.current = true;
    setCreatingToken(true);

    createToken
      .mutate({
        instanceId,
        name: `${server.name ?? 'Magic MCP Server'} Token`,
        magicMcpServerId: server.id
      })
      .then(([token, error]) => {
        if (token?.secret) {
          setCreatedToken({ id: token.id, secret: token.secret });
        } else if (!error) {
          setFallbackError('Could not create a Magic MCP token for this server.');
        }
      })
      .catch(() => {
        setFallbackError('Could not create a Magic MCP token for this server.');
      })
      .finally(() => setCreatingToken(false));
  }, [
    createToken,
    existingToken,
    instanceId,
    server.id,
    server.name,
    tokens.data,
    tokens.error,
    tokens.isLoading
  ]);

  let endpoint = server.endpoints[0]?.url;
  let secret = existingToken?.secret ?? createdToken?.secret;
  let fullUrl = endpoint && secret ? `${endpoint}?key=${secret}` : null;

  return (
    <Box
      title={`Connect to ${server.name ?? 'Magic MCP Server'}`}
      description="Use this Magic MCP endpoint to connect to your server."
    >
      {renderWithLoader({ tokens })(() => (
        <McpConnectionInstructionsScene
          name={server.name ?? 'Magic MCP Server'}
          tokenLabel="Magic MCP Token"
          tokenValue={secret ?? null}
          tokenCopyValue={secret ?? ''}
          endpointLabel="Endpoint"
          endpointValue={fullUrl ?? endpoint ?? '...'}
          endpointCopyValue={fullUrl ?? endpoint ?? ''}
          snippetUrl={endpoint ?? null}
          snippetToken={secret ?? null}
          emptyState={
            <Flex direction="column" gap={12} style={{ alignItems: 'flex-start' }}>
              <createToken.RenderError />
              {fallbackError ? (
                <Callout color="red">{fallbackError}</Callout>
              ) : (
                !createToken.error && (
                  <Text size="2">
                    {creatingToken
                      ? 'Creating a Magic MCP token for this server...'
                      : 'No active Magic MCP token found for this server. Create one in Tokens to connect clients.'}
                  </Text>
                )
              )}
            </Flex>
          }
        />
      ))}
    </Box>
  );
};
