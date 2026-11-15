import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { expectOk, mcp, type RestClient } from './api';
import { metorialEndpoints } from './env';

export interface RemoteProvider {
  customProvider: any;
  provider: any;
  providerId: string;
  deployment: any;
}

/**
 * Creates a remote custom provider pointing at an MCP server (e.g. `useMcpTestServer().url`) and
 * waits until its deployment succeeded and the provider exists. `client` is an instance-key client.
 */
export let createRemoteProvider = async (
  client: RestClient,
  input: {
    url: string;
    protocol?: 'sse' | 'streamable_http' | 'stateless';
    name?: string;
    timeoutMs?: number;
  }
): Promise<RemoteProvider> => {
  let customProvider = expectOk(
    await client.post('/custom-providers', {
      name: input.name ?? uniqueId('e2e-provider'),
      from: {
        type: 'remote',
        remote_url: input.url,
        protocol: input.protocol ?? 'streamable_http'
      }
    })
  );

  let deployment = await eventually(
    async () => {
      let list = expectOk(
        await client.get('/custom-provider-deployments', {
          query: { custom_provider_id: customProvider.id }
        })
      );
      let item = list.items[0];
      if (item?.status === 'failed') {
        throw new Error(`Deployment of ${customProvider.id} failed: ${JSON.stringify(item)}`);
      }
      if (item?.status !== 'succeeded') {
        throw new Error(`Deployment of ${customProvider.id} is ${item?.status ?? 'missing'}`);
      }
      return item;
    },
    { timeoutMs: input.timeoutMs ?? 60_000, intervalMs: 500 }
  );

  let refreshed = expectOk(await client.get(`/custom-providers/${customProvider.id}`));
  if (!refreshed.provider?.id)
    throw new Error(`Custom provider ${customProvider.id} has no provider`);

  return {
    customProvider: refreshed,
    provider: refreshed.provider,
    providerId: refreshed.provider.id,
    deployment
  };
};

export let createProviderDeployment = async (client: RestClient, providerId: string) =>
  expectOk(
    await client.post('/provider-deployments', {
      provider_id: providerId,
      name: uniqueId('e2e-deployment')
    })
  );

/** Creates a session with one ephemeral deployment per provider id. */
export let createProviderSession = async (
  client: RestClient,
  providerIds: string[],
  body: Record<string, unknown> = {}
) =>
  expectOk(
    await client.post('/sessions', {
      ...body,
      providers: providerIds.map(providerId => ({
        provider_deployment: { provider_id: providerId }
      }))
    })
  );

/** An MCP client for a session's connection URL, authenticated with an instance secret key. */
export let connectSession = (sessionId: string, apiKey: string) =>
  mcp(`${metorialEndpoints().mcp}/connect/mcp/${sessionId}`, { apiKey });

/** Finds a session tool by the name the upstream MCP server gave it (session tools are prefixed). */
export let findTool = <T extends { name: string; title?: string }>(
  tools: T[],
  name: string
) => {
  let tool = tools.find(tool => tool.title === name || tool.name.endsWith(`_tool_${name}`));
  if (!tool) {
    throw new Error(`No tool ${name} in ${JSON.stringify(tools.map(tool => tool.name))}`);
  }
  return tool;
};
