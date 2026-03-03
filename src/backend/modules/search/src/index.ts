import { createVoyagerClient } from '@metorial-services/voyager-client';
import { env } from './env';

type MagicVoyagerIndex = 'magicMcpGroup' | 'magicMcpServer';

type VoyagerSearchInput = {
  index: MagicVoyagerIndex;
  instanceId: string;
  query: string;
};

type VoyagerDeleteInput = {
  index: MagicVoyagerIndex;
  id: string;
};

type VoyagerIndexInput = {
  index: MagicVoyagerIndex;
  id: string;
  instanceId: string;
  fields: Record<string, unknown>;
  body: Record<string, unknown>;
};

type MagicMcpGroupIndexInput = {
  id: string;
  instanceId: string;
  slug: string;
  name?: string | null;
  description?: string | null;
};

type MagicMcpServerIndexInput = {
  id: string;
  instanceId: string;
  aliases: string[];
  name?: string | null;
  description?: string | null;
};

let getIndexName = (suffix: string) =>
  [env.service.VOYAGER_INDEX_PREFIX, 'metorial', suffix].filter(Boolean).join('_');

export let voyager: any = env.service.VOYAGER_URL
  ? createVoyagerClient({
      endpoint: env.service.VOYAGER_URL
    })
  : null;

let voyagerSourcePromise: Promise<any> | null = null;
let voyagerIndexPromises: Partial<Record<MagicVoyagerIndex, Promise<any>>> = {};

let voyagerIndexes = {
  magicMcpGroup: {
    identifier: 'magic_mcp_group',
    name: 'Magic MCP Groups'
  },
  magicMcpServer: {
    identifier: 'magic_mcp_server',
    name: 'Magic MCP Servers'
  }
} satisfies Record<MagicVoyagerIndex, { identifier: string; name: string }>;

let ensureVoyagerSource = async () => {
  if (!voyager) return null;

  if (!voyagerSourcePromise) {
    voyagerSourcePromise = voyager.source
      .upsert({
        name: 'Metorial Platform',
        identifier: getIndexName('source')
      })
      .catch((error: unknown) => {
        voyagerSourcePromise = null;
        throw error;
      });
  }

  return await voyagerSourcePromise;
};

let ensureVoyagerIndex = async (index: MagicVoyagerIndex) => {
  let voyagerClient = voyager;
  if (!voyagerClient) return null;

  if (!voyagerIndexPromises[index]) {
    voyagerIndexPromises[index] = (async () => {
      let source = await ensureVoyagerSource();
      if (!source) return null;

      return await voyagerClient.index.upsert({
        sourceId: source.id,
        identifier: getIndexName(voyagerIndexes[index].identifier),
        name: voyagerIndexes[index].name
      });
    })().catch((error: unknown) => {
      delete voyagerIndexPromises[index];
      throw error;
    });
  }

  return await voyagerIndexPromises[index];
};

let searchByIndex = async (d: VoyagerSearchInput): Promise<string[] | undefined> => {
  if (!voyager) return undefined;
  if (!d.query.trim()) return undefined;

  try {
    let source = await ensureVoyagerSource();
    let index = await ensureVoyagerIndex(d.index);
    if (!source || !index) return undefined;

    let records = await voyager.record.search({
      tenantId: d.instanceId,
      sourceId: source.id,
      indexId: index.id,
      query: d.query.trim()
    });

    return records
      .map((record: any) =>
        typeof record?.documentId === 'string' ? (record.documentId as string) : null
      )
      .filter((id: string | null): id is string => !!id);
  } catch (error) {
    console.error(`[module-search] Voyager search failed for ${d.index}`, error);
    return undefined;
  }
};

let indexByType = async (d: VoyagerIndexInput) => {
  if (!voyager) return;

  try {
    let source = await ensureVoyagerSource();
    let index = await ensureVoyagerIndex(d.index);
    if (!source || !index) return;

    await voyager.record.index({
      sourceId: source.id,
      indexId: index.id,
      documentId: d.id,
      tenantIds: [d.instanceId],
      fields: d.fields,
      body: d.body
    });
  } catch (error) {
    console.error(`[module-search] Voyager indexing failed for ${d.index}`, error);
  }
};

let deleteByType = async (d: VoyagerDeleteInput) => {
  if (!voyager) return;

  try {
    let source = await ensureVoyagerSource();
    let index = await ensureVoyagerIndex(d.index);
    if (!source || !index) return;

    await voyager.record.delete({
      sourceId: source.id,
      indexId: index.id,
      documentIds: [d.id]
    });
  } catch (error) {
    console.error(`[module-search] Voyager delete failed for ${d.index}`, error);
  }
};

export let searchMagicMcpGroupIds = async (d: { instanceId: string; query: string }) =>
  await searchByIndex({
    index: 'magicMcpGroup',
    instanceId: d.instanceId,
    query: d.query
  });

export let searchMagicMcpServerIds = async (d: { instanceId: string; query: string }) =>
  await searchByIndex({
    index: 'magicMcpServer',
    instanceId: d.instanceId,
    query: d.query
  });

export let indexMagicMcpGroupDocument = async (d: MagicMcpGroupIndexInput) =>
  await indexByType({
    index: 'magicMcpGroup',
    id: d.id,
    instanceId: d.instanceId,
    fields: {
      magicMcpGroupId: d.id,
      slug: d.slug
    },
    body: {
      id: d.id,
      slug: d.slug,
      name: d.name ?? undefined,
      description: d.description ?? undefined
    }
  });

export let indexMagicMcpServerDocument = async (d: MagicMcpServerIndexInput) =>
  await indexByType({
    index: 'magicMcpServer',
    id: d.id,
    instanceId: d.instanceId,
    fields: {
      magicMcpServerId: d.id
    },
    body: {
      id: d.id,
      name: d.name ?? undefined,
      description: d.description ?? undefined,
      aliases: d.aliases.join(' ')
    }
  });

export let deleteMagicMcpGroupDocument = async (d: { id: string }) =>
  await deleteByType({
    index: 'magicMcpGroup',
    id: d.id
  });

export let deleteMagicMcpServerDocument = async (d: { id: string }) =>
  await deleteByType({
    index: 'magicMcpServer',
    id: d.id
  });
