import {
  connectSession,
  createProviderSession,
  createRemoteProvider,
  eventually,
  firstPage,
  type McpTestTool,
  uniqueId,
  type useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import type { Provider } from '@metorial-subspace/db';
import { providerService, providerToolService } from '../src';

type Organization = ReturnType<typeof useOrganization>;

type Paginator<T> = {
  run: (input: { limit?: number; after?: string; order?: 'asc' | 'desc' }) => Promise<{
    items: T[];
    pagination: { hasNextPage: boolean };
  }>;
};

export let catalogTools: McpTestTool[] = [
  {
    name: 'lookup_entry',
    description: 'Looks up a catalog entry',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string' } },
      required: ['key']
    },
    handler: args => `entry:${args.key}`
  },
  {
    name: 'count_entries',
    description: 'Counts the catalog entries',
    inputSchema: { type: 'object', properties: {} },
    handler: () => '0'
  }
];

export let deployCatalogProvider = async (org: Organization, url: string) => {
  let name = uniqueId('catalog-provider');
  let { providerId } = await createRemoteProvider(org.clients.instance, { url, name });
  let { instance } = await loadOrganizationFixture(org.ids);

  let session = await createProviderSession(org.clients.instance, [providerId]);
  let client = connectSession(session.id, org.keys.instanceSecret);
  await client.initialize();
  await client.listTools();

  return eventually(
    async () => {
      let provider = await subspaceDb.provider.findUniqueOrThrow({
        where: { id: providerId },
        include: {
          listing: true,
          publisher: true,
          type: true,
          defaultVariant: { include: { currentVersion: true } }
        }
      });
      let version = provider.defaultVariant?.currentVersion;
      if (!provider.listing || !version?.specificationOid) {
        throw new Error(`Provider ${providerId} has no specification yet`);
      }

      let tools = await firstPage(
        await providerToolService.listProviderTools({ instance, providerVersion: version })
      );
      let missing = catalogTools.filter(
        tool => !tools.some(found => found.name === tool.name)
      );
      if (missing.length) {
        throw new Error(`Provider ${providerId} has not discovered ${missing.length} tool(s)`);
      }

      return { name, provider, listing: provider.listing, version, tools };
    },
    { timeoutMs: 120_000, intervalMs: 1_000 }
  );
};

export type CatalogProvider = Awaited<ReturnType<typeof deployCatalogProvider>>;

export let makeProviderGlobal = async (provider: Provider) => {
  await providerService.updateProvider({ provider, input: { access: 'public' } });
  await subspaceDb.provider.update({
    where: { oid: provider.oid },
    data: { hasEnvironments: false }
  });
  await subspaceDb.providerVersion.updateMany({
    where: { providerOid: provider.oid },
    data: { isEnvironmentLocked: false }
  });
};

export let makeProviderTenantOwned = async (provider: Provider) => {
  await providerService.updateProvider({
    provider,
    input: { access: 'tenant', isDeprecated: false, isVerified: false }
  });
  await subspaceDb.provider.update({
    where: { oid: provider.oid },
    data: { hasEnvironments: true }
  });
  await subspaceDb.providerVersion.updateMany({
    where: { providerOid: provider.oid },
    data: { isEnvironmentLocked: true }
  });
};

export let listAllPages = async <T extends { id: string }>(paginator: Paginator<T>) => {
  let items: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < 50; page++) {
    let result = await paginator.run({ limit: 100, after });
    items.push(...result.items);
    if (!result.pagination.hasNextPage || !result.items.length) return items;
    after = result.items.at(-1)!.id;
  }

  throw new Error('The list still had more pages after 50 pages');
};

export let pageIds = async <T extends { id: string }>(paginator: Paginator<T>) => {
  let pages: string[][] = [];
  let after: string | undefined;

  for (let page = 0; page < 20; page++) {
    let result = await paginator.run({ limit: 1, after });
    pages.push(result.items.map(item => item.id));
    if (!result.pagination.hasNextPage || !result.items.length) return pages;
    after = result.items.at(-1)!.id;
  }

  throw new Error('The list still had more pages after 20 pages');
};
