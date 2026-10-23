import {
  type BootstrappedOrganization,
  createRemoteProvider,
  expectOk,
  type McpTestServer,
  uniqueId,
  useFixture
} from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';

export let onlyEchoFilter = {
  type: 'v1.filter' as const,
  filters: [{ type: 'tool_keys' as const, keys: ['echo'] }]
};

export let onlyAddFilter = {
  type: 'v1.filter' as const,
  filters: [{ type: 'tool_keys' as const, keys: ['add'] }]
};

export let sessionScope = async (org: BootstrappedOrganization) => {
  let fixture = await loadOrganizationFixture(org.ids);
  return { instance: fixture.instance, auditScope: fixture.auditScope };
};

export let createDeployment = async (org: BootstrappedOrganization, providerId: string) => {
  let deployment = expectOk(
    await org.clients.instance.post('/provider-deployments', {
      provider_id: providerId,
      name: uniqueId('deployment')
    })
  );
  return deployment.id as string;
};

export let archiveDeployment = async (org: BootstrappedOrganization, deploymentId: string) =>
  expectOk(await org.clients.instance.delete(`/provider-deployments/${deploymentId}`));

export let useRemoteProviders = (input: {
  org: BootstrappedOrganization;
  otherOrg: BootstrappedOrganization;
  server: McpTestServer;
}) =>
  useFixture(async () => {
    let [first, second, foreign] = await Promise.all([
      createRemoteProvider(input.org.clients.instance, { url: input.server.url }),
      createRemoteProvider(input.org.clients.instance, { url: input.server.url }),
      createRemoteProvider(input.otherOrg.clients.instance, { url: input.server.url })
    ]);

    return {
      first: first.providerId,
      second: second.providerId,
      foreign: foreign.providerId
    };
  });

export let pageAll = async <T extends { id: string }>(paginator: {
  run: (input: {
    limit: number;
    after?: string;
  }) => Promise<{ items: T[]; pagination: { hasNextPage: boolean } }>;
}) => {
  let items: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < 50; page++) {
    let list = await paginator.run({ limit: 1, ...(after ? { after } : {}) });
    items.push(...list.items);

    if (!list.pagination.hasNextPage || !list.items.length) return items;
    after = list.items.at(-1)!.id;
  }

  throw new Error('Paginator still had more pages after 50 pages');
};
