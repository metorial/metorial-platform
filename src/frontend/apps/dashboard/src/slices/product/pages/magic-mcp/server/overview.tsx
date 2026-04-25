import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useMagicMcpServer,
  useMagicMcpTokens,
  useProviders,
  useSessionTemplateProviders
} from '@metorial/state';
import { Attributes, Flex, RenderDate, Text } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { McpConnectionInstructionsScene } from '../../../scenes/mcpConnectionInstructions';

export let MagicMcpServerOverviewPage = () => {
  let instance = useCurrentInstance();
  let { magicMcpServerId } = useParams();

  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);
  let tokens = useMagicMcpTokens(
    instance.data?.id && server.data?.id ? instance.data.id : null,
    {
      status: 'active',
      magicMcpServerId: server.data?.id
    }
  );
  let createToken = tokens.createMutator();
  let templateProviders = useSessionTemplateProviders(
    instance.data?.id,
    server.data?.sessionTemplateId
  );
  let initializingTokenRef = useRef<string | undefined>(undefined);
  let [creatingInitialToken, setCreatingInitialToken] = useState(false);
  let [createdInitialToken, setCreatedInitialToken] = useState<{
    instanceId: string;
    serverId: string;
    id: string;
    secret: string;
    status: 'active';
    groups: [];
  } | null>(null);
  let providerIds = useMemo(
    () => [
      ...new Set(
        (templateProviders.data?.items ?? []).map(
          p => p.providerId ?? p.deployment.providerId ?? p.id
        )
      )
    ],
    [templateProviders.data?.items]
  );
  let providers = useProviders(instance.data?.id, { id: providerIds });
  let existingServerTokenId = tokens.data?.items.find(
    t => t.status === 'active' && t.server?.id === server.data?.id
  )?.id;

  useEffect(() => {
    if (!instance.data?.id || !server.data?.id) return;
    let instanceId = instance.data.id;
    let serverId = server.data.id;
    let initializingKey = `${instanceId}:${serverId}`;

    if (
      !tokens.error &&
      !tokens.isLoading &&
      tokens.data &&
      !existingServerTokenId &&
      initializingTokenRef.current !== initializingKey
    ) {
      setCreatingInitialToken(true);
      initializingTokenRef.current = initializingKey;

      createToken
        .mutate({
          instanceId,
          name: `${server.data.name ?? 'Magic MCP Server'} Token`,
          magicMcpServerId: serverId
        })
        .then(([res]) => {
          if (!res) initializingTokenRef.current = undefined;
          if (res?.secret) {
            setCreatedInitialToken({
              instanceId,
              serverId,
              id: res.id,
              secret: res.secret,
              status: 'active',
              groups: []
            });
          }
        })
        .finally(() => {
          setCreatingInitialToken(false);
        });
    }
  }, [
    createToken,
    existingServerTokenId,
    instance.data?.id,
    server.data?.id,
    server.data?.name,
    tokens.error,
    tokens.isLoading
  ]);

  return renderWithLoader({ server, tokens, templateProviders, providers })(
    ({ server, tokens, templateProviders, providers }) => {
      let streamableHttpUrl = server.data.endpoints[0]?.url;
      let createdToken =
        createdInitialToken?.instanceId === instance.data?.id &&
        createdInitialToken?.serverId === server.data.id
          ? createdInitialToken
          : null;
      let activeToken =
        tokens.data.items.find(
          t => t.status === 'active' && t.server?.id === server.data.id
        ) ??
        createdToken;
      let activeTokenSecret = activeToken?.secret;
      let fullUrl =
        streamableHttpUrl && activeTokenSecret
          ? `${streamableHttpUrl}?key=${activeTokenSecret}`
          : null;
      let hasRelatedActiveToken = tokens.data.items.length > 0;
      let providerNameMap = new Map<string, string>();
      for (let provider of providers.data?.items ?? []) {
        if (provider.id && provider.name) providerNameMap.set(provider.id, provider.name);
      }

      let providerPreviewItems = templateProviders.data.items.slice(0, 4);
      let remainingProviderCount =
        templateProviders.data.items.length - providerPreviewItems.length;
      let detailsPathParams = [
        instance.data?.organization,
        instance.data?.project,
        instance.data,
        server.data.id
      ] as const;

      return (
        <Flex direction="column" gap={16}>
          <Box
            title={
              <Flex gap={8} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{server.data.name ?? 'Magic MCP Server'}</span>
              </Flex>
            }
            description="Magic MCP servers are reusable MCP servers linked to providers in Metorial."
          >
            <Attributes
              itemWidth="280px"
              attributes={[
                {
                  label: 'ID',
                  content: <ID id={server.data.id} />
                },
                {
                  label: 'Server Identifier',
                  content: <ID id={server.data.endpoints[0]?.alias ?? '...'} />
                },
                {
                  label: 'Created At',
                  content: <RenderDate date={server.data.createdAt} />
                }
              ]}
            />

            {/* <Spacer height={16} />

            <Copy
              label="Primary Endpoint"
              value={streamableHttpUrl ?? '...'}
              copyValue={streamableHttpUrl ?? ''}
            /> */}
          </Box>

          {/* <Box
            title="Providers"
            description="Sessions created through this server inherit providers from its session template."
            rightActions={
              <Link to={Paths.instance.magicMcp.server(...detailsPathParams, 'providers')}>
                <Button as="span" size="1" variant="outline">
                  Manage Providers
                </Button>
              </Link>
            }
          >
            <Flex direction="column" gap={12}>
              {providerPreviewItems.length > 0 ? (
                <Flex direction="column" gap={10}>
                  {providerPreviewItems.map(provider => {
                    let providerId =
                      provider.providerId ?? provider.deployment.providerId ?? provider.id;
                    let providerName = providerNameMap.get(providerId) ?? providerId;
                    let providerDeploymentLabel =
                      provider.deployment.name ?? provider.deployment.id;

                    return (
                      <Entity.Wrapper key={provider.id}>
                        <Entity.Content>
                          <Entity.Field
                            title={providerName}
                            description={providerDeploymentLabel}
                            prefix={
                              <Avatar
                                entity={{
                                  name: providerName
                                }}
                                size={28}
                                radius={8}
                                noTooltip
                                imageFit="contain"
                              />
                            }
                          />
                        </Entity.Content>
                      </Entity.Wrapper>
                    );
                  })}

                  {remainingProviderCount > 0 ? (
                    <Text size="2" color="gray600">
                      And {remainingProviderCount} more provider
                      {remainingProviderCount === 1 ? '' : 's'}.
                    </Text>
                  ) : null}
                </Flex>
              ) : (
                <Flex direction="column" gap={6}>
                  <Text size="2" color="gray600">
                    No providers have been added to this server yet.
                  </Text>
                  <Text size="2" color="gray600">
                    Use <strong>Manage Providers</strong> to attach providers to this server.
                  </Text>
                </Flex>
              )}
            </Flex>
          </Box> */}

          <Box
            title={`Connect to ${server.data.name ?? 'Magic MCP Server'}`}
            description="Use this Magic MCP endpoint to connect to your server."
          >
            <McpConnectionInstructionsScene
              name={server.data.name ?? 'Magic MCP Server'}
              tokenLabel="Magic MCP Token"
              tokenValue={activeTokenSecret ?? null}
              tokenCopyValue={activeTokenSecret ?? ''}
              endpointLabel="Endpoint"
              endpointValue={fullUrl ?? streamableHttpUrl ?? '...'}
              endpointCopyValue={fullUrl ?? streamableHttpUrl ?? ''}
              snippetUrl={streamableHttpUrl ?? null}
              snippetToken={activeTokenSecret ?? null}
              emptyState={
                <Flex direction="column" gap={12} style={{ alignItems: 'flex-start' }}>
                  <Text size="2">
                    {creatingInitialToken
                      ? 'Creating a Magic MCP token for this server...'
                      : hasRelatedActiveToken
                        ? 'No token directly linked to this Magic MCP server found. Create a server-specific token from the Tokens tab to generate a guaranteed working connection snippet.'
                        : 'No active Magic MCP token found for this server. Create one from the Tokens tab to connect clients.'}
                  </Text>
                </Flex>
              }
            />
          </Box>
        </Flex>
      );
    }
  );
};
