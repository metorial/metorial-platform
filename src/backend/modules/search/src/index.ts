import { env } from './env';

type VoyagerIndex =
  | 'consumer'
  | 'consumerGroup'
  | 'consumerAccessRequest'
  | 'providerTemplate'
  | 'magicMcpGroup'
  | 'magicMcpServer';

type VoyagerSearchInput = {
  index: VoyagerIndex;
  instanceId: string;
  query: string;
};

type VoyagerDeleteInput = {
  index: VoyagerIndex;
  id: string;
};

type VoyagerIndexInput = {
  index: VoyagerIndex;
  id: string;
  instanceId: string;
  fields: Record<string, unknown>;
  body: Record<string, unknown>;
};

type ConsumerIndexInput = {
  id: string;
  instanceId: string;
  name?: string | null;
  email: string;
};

type ConsumerGroupIndexInput = {
  id: string;
  instanceId: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description?: string | null;
  ssoGroupIds: string[];
};

type ProviderTemplateIndexInput = {
  id: string;
  instanceId: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description?: string | null;
  providerDeploymentId: string;
};

type ConsumerAccessRequestIndexInput = {
  id: string;
  instanceId: string;
  status: 'pending' | 'approved' | 'rejected';
  message?: string | null;
  resolutionMessage?: string | null;
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

let loadModule = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<any>;

export let voyager: any = null;
let voyagerPromise: Promise<any> | null = null;
let voyagerLoadFailed = false;

let voyagerSourcePromise: Promise<any> | null = null;
let voyagerIndexPromises: Partial<Record<VoyagerIndex, Promise<any>>> = {};

let voyagerIndexes = {
  consumer: {
    identifier: 'consumer',
    name: 'Consumers'
  },
  consumerGroup: {
    identifier: 'consumer_group',
    name: 'Consumer Groups'
  },
  consumerAccessRequest: {
    identifier: 'consumer_access_request',
    name: 'Consumer Access Requests'
  },
  providerTemplate: {
    identifier: 'provider_template',
    name: 'Provider Templates'
  },
  magicMcpGroup: {
    identifier: 'magic_mcp_group',
    name: 'Magic MCP Groups'
  },
  magicMcpServer: {
    identifier: 'magic_mcp_server',
    name: 'Magic MCP Servers'
  }
} satisfies Record<VoyagerIndex, { identifier: string; name: string }>;

let getVoyager = async () => {
  if (!env.service.VOYAGER_URL || voyagerLoadFailed) return null;
  if (voyager) return voyager;

  if (!voyagerPromise) {
    voyagerPromise = loadModule('@metorial-services/voyager-client')
      .then(module =>
        module.createVoyagerClient({
          endpoint: env.service.VOYAGER_URL!
        })
      )
      .then(client => {
        voyager = client;
        return client;
      })
      .catch((error: unknown) => {
        voyagerPromise = null;
        voyagerLoadFailed = true;
        console.warn('[module-search] Voyager client is unavailable, disabling search', error);
        return null;
      });
  }

  return await voyagerPromise;
};

let ensureVoyagerSource = async () => {
  let voyagerClient = await getVoyager();
  if (!voyagerClient) return null;

  if (!voyagerSourcePromise) {
    voyagerSourcePromise = voyagerClient.source
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

let ensureVoyagerIndex = async (index: VoyagerIndex) => {
  let voyagerClient = await getVoyager();
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

let searchByIndex = async (d: VoyagerSearchInput): Promise<string[]> => {
  if (!d.query.trim()) return [];

  try {
    let voyagerClient = await getVoyager();
    if (!voyagerClient) return [];

    let source = await ensureVoyagerSource();
    let index = await ensureVoyagerIndex(d.index);
    if (!source || !index) return [];

    let records = await voyagerClient.record.search({
      tenantId: d.instanceId,
      sourceId: source.id,
      indexId: index.id,
      query: d.query.trim()
    });

    return records;
  } catch (error) {
    console.error(`[module-search] Voyager search failed for ${d.index}`, error);
    return [];
  }
};

let indexByType = async (d: VoyagerIndexInput) => {
  try {
    let voyagerClient = await getVoyager();
    if (!voyagerClient) return;

    let source = await ensureVoyagerSource();
    let index = await ensureVoyagerIndex(d.index);
    if (!source || !index) return;

    await voyagerClient.record.index({
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
  try {
    let voyagerClient = await getVoyager();
    if (!voyagerClient) return;

    let source = await ensureVoyagerSource();
    let index = await ensureVoyagerIndex(d.index);
    if (!source || !index) return;

    await voyagerClient.record.delete({
      sourceId: source.id,
      indexId: index.id,
      documentIds: [d.id]
    });
  } catch (error) {
    console.error(`[module-search] Voyager delete failed for ${d.index}`, error);
  }
};

export let searchConsumerIds = async (d: { instanceId: string; query: string }) =>
  await searchByIndex({
    index: 'consumer',
    instanceId: d.instanceId,
    query: d.query
  });

export let searchConsumerGroupIds = async (d: { instanceId: string; query: string }) =>
  await searchByIndex({
    index: 'consumerGroup',
    instanceId: d.instanceId,
    query: d.query
  });

export let searchConsumerAccessRequestIds = async (d: { instanceId: string; query: string }) =>
  await searchByIndex({
    index: 'consumerAccessRequest',
    instanceId: d.instanceId,
    query: d.query
  });

export let searchProviderTemplateIds = async (d: { instanceId: string; query: string }) =>
  await searchByIndex({
    index: 'providerTemplate',
    instanceId: d.instanceId,
    query: d.query
  });

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

export let indexConsumerDocument = async (d: ConsumerIndexInput) =>
  await indexByType({
    index: 'consumer',
    id: d.id,
    instanceId: d.instanceId,
    fields: {
      consumerId: d.id
    },
    body: {
      id: d.id,
      name: d.name ?? undefined,
      email: d.email
    }
  });

export let indexConsumerGroupDocument = async (d: ConsumerGroupIndexInput) =>
  await indexByType({
    index: 'consumerGroup',
    id: d.id,
    instanceId: d.instanceId,
    fields: {
      consumerGroupId: d.id,
      status: d.status
    },
    body: {
      id: d.id,
      status: d.status,
      name: d.name,
      description: d.description ?? undefined,
      ssoGroupIds: d.ssoGroupIds.join(' ')
    }
  });

export let indexConsumerAccessRequestDocument = async (d: ConsumerAccessRequestIndexInput) =>
  await indexByType({
    index: 'consumerAccessRequest',
    id: d.id,
    instanceId: d.instanceId,
    fields: {
      consumerAccessRequestId: d.id,
      status: d.status
    },
    body: {
      status: d.status,
      message: d.message ?? undefined,
      resolutionMessage: d.resolutionMessage ?? undefined
    }
  });

export let indexProviderTemplateDocument = async (d: ProviderTemplateIndexInput) =>
  await indexByType({
    index: 'providerTemplate',
    id: d.id,
    instanceId: d.instanceId,
    fields: {
      providerTemplateId: d.id,
      status: d.status,
      providerDeploymentId: d.providerDeploymentId
    },
    body: {
      id: d.id,
      status: d.status,
      name: d.name,
      description: d.description ?? undefined,
      providerDeploymentId: d.providerDeploymentId
    }
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

export let deleteConsumerDocument = async (d: { id: string }) =>
  await deleteByType({
    index: 'consumer',
    id: d.id
  });

export let deleteConsumerGroupDocument = async (d: { id: string }) =>
  await deleteByType({
    index: 'consumerGroup',
    id: d.id
  });

export let deleteConsumerAccessRequestDocument = async (d: { id: string }) =>
  await deleteByType({
    index: 'consumerAccessRequest',
    id: d.id
  });

export let deleteProviderTemplateDocument = async (d: { id: string }) =>
  await deleteByType({
    index: 'providerTemplate',
    id: d.id
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
