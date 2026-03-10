import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useMagicMcpServer,
  useMagicMcpTokens,
  useProviderListings,
  useProviders,
  useSessionTemplateProviders
} from '@metorial/state';
import {
  Attributes,
  Avatar,
  Badge,
  Button,
  Copy,
  Entity,
  Flex,
  RenderDate,
  Spacer,
  Tabs,
  Text,
  useCopy
} from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ConnectionType, connectionTypes } from '../components/connection';

export let MagicMcpServerOverviewPage = () => {
  let instance = useCurrentInstance();
  let { magicMcpServerId } = useParams();

  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);
  let tokens = useMagicMcpTokens(instance.data?.id, {
    status: 'active'
  });
  let templateProviders = useSessionTemplateProviders(
    instance.data?.id,
    server.data?.sessionTemplateId
  );
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
  let providers = useProviders(
    instance.data?.id,
    { id: providerIds }
  );
  let listings = useProviderListings({});

  let [tab, setTab] = useState<ConnectionType>('cursor');
  let copy = useCopy();

  return renderWithLoader({ server, tokens, templateProviders, providers })(
    ({ server, tokens, templateProviders, providers }) => {
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
      let providerNameMap = new Map<string, string>();
      for (let provider of providers.data?.items ?? []) {
        if (provider.id && provider.name) providerNameMap.set(provider.id, provider.name);
      }
      let providerImageMap = new Map<string, string>();
      for (let listing of listings.data?.items ?? []) {
        let pid = listing.provider?.id;
        if (pid && listing.imageUrl) providerImageMap.set(pid, listing.imageUrl);
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
      let aliasBadges =
        server.data.endpoints.length > 0
          ? server.data.endpoints.map(endpoint => (
              <Badge key={endpoint.id} color="gray" size="1">
                {endpoint.alias}
              </Badge>
            ))
          : null;

      return (
        <Flex direction="column" gap={16}>
          <Box
            title={
              <Flex gap={8} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{server.data.name ?? 'Magic MCP Server'}</span>
                {aliasBadges}
              </Flex>
            }
            description="Key metadata for this Magic MCP server and its linked session template."
          >
            <Attributes
              itemWidth="280px"
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
                  label: 'Created At',
                  content: <RenderDate date={server.data.createdAt} />
                }
              ]}
            />

            <Spacer height={16} />

            <Copy
              label="Primary Endpoint"
              value={streamableHttpUrl ?? '...'}
              copyValue={streamableHttpUrl ?? ''}
            />
          </Box>

          <Box
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
                                  name: providerName,
                                  photoUrl: providerImageMap.get(providerId)
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
          </Box>

          <Box
            title={`Connect to ${server.data.name ?? 'Magic MCP Server'}`}
            description="Use this Magic MCP endpoint to connect to your server."
          >
            {activeToken ? (
              <>
                <Copy
                  label="Endpoint"
                  value={fullUrl ?? streamableHttpUrl ?? '...'}
                  copyValue={fullUrl ?? streamableHttpUrl ?? ''}
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
                        <Text
                          size="2"
                          weight="strong"
                          style={{ display: 'block', marginBottom: 12 }}
                        >
                          {`${idx + 1}. ${step.text}`}
                        </Text>

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
                            <Spacer height={16} />
                          </>
                        )}

                        {'command' in step && !step.command ? <Spacer height={8} /> : null}
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
                        <Spacer height={16} />
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <Flex direction="column" gap={12} style={{ alignItems: 'flex-start' }}>
                <Text size="2">
                  {hasRestrictedActiveToken
                    ? 'No unrestricted Magic MCP token found. Create a token without group restrictions from the Tokens tab to generate a guaranteed working connection snippet.'
                    : 'No active Magic MCP token found. Create one from the Tokens tab to connect clients.'}
                </Text>
              </Flex>
            )}
          </Box>
        </Flex>
      );
    }
  );
};
