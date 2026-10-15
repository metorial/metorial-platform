import { createVoyagerClient } from '@metorial-platform-systems/voyager-client';
import { env } from './env';

type VoyagerIndex =
  | 'firewall'
  | 'consumer'
  | 'consumerGroup'
  | 'consumerAccessRequest'
  | 'providerTemplate'
  | 'magicMcpGroup'
  | 'magicMcpServer'
  | 'sandboxImage'
  | 'sandboxMachine'
  | 'sandboxDisk';

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
};

type ConsumerAccessRequestIndexInput = {
  id: string;
  instanceId: string;
  status: 'pending' | 'approved' | 'rejected';
  message?: string | null;
  resolutionMessage?: string | null;
  requesterName?: string | null;
  requesterEmail?: string | null;
  providerName?: string | null;
  providerDescription?: string | null;
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

type SandboxImageIndexInput = {
  id: string;
  tenantId: string;
  name?: string | null;
  identifier?: string | null;
};

type SandboxMachineIndexInput = {
  id: string;
  instanceId: string;
  name?: string | null;
  slug: string;
};

type SandboxDiskIndexInput = {
  id: string;
  instanceId: string;
  name?: string | null;
};

export let sandboxGlobalSearchTenantId = 'sandbox_global';

let getIndexName = (suffix: string) =>
  [env.service.VOYAGER_INDEX_PREFIX, 'metorial', suffix].filter(Boolean).join('_');

export let voyager: ReturnType<typeof createVoyagerClient> | null = env.service.VOYAGER_URL
  ? createVoyagerClient({
      endpoint: env.service.VOYAGER_URL
    })
  : null;

let voyagerSourcePromise: Promise<any> | null = null;
let voyagerIndexPromises: Partial<Record<VoyagerIndex, Promise<any>>> = {};

let voyagerIndexes = {
  firewall: {
    identifier: 'firewall',
    name: 'Firewalls'
  },
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
  },
  sandboxImage: {
    identifier: 'sandbox_image',
    name: 'Sandbox Images'
  },
  sandboxDisk: {
    identifier: 'sandbox_disk',
    name: 'Sandbox Disks'
  },
  sandboxMachine: {
    identifier: 'sandbox_machine',
    name: 'Sandbox Machines'
  }
} satisfies Record<VoyagerIndex, { identifier: string; name: string }>;

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

let ensureVoyagerIndex = async (index: VoyagerIndex) => {
  if (!voyager) return null;

  if (!voyagerIndexPromises[index]) {
    voyagerIndexPromises[index] = (async () => {
      let source = await ensureVoyagerSource();
      if (!source) return null;

      return await voyager.index.upsert({
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
    if (!voyager) return [];

    let source = await ensureVoyagerSource();
    let index = await ensureVoyagerIndex(d.index);
    if (!source || !index) return [];

    let records = await voyager.record.search({
      tenantId: d.instanceId,
      sourceId: source.id,
      indexId: index.id,
      query: d.query.trim()
    });

    return records
      .map(record => record.documentId)
      .filter((documentId): documentId is string => !!documentId);
  } catch (error) {
    console.error(`[module-search] Voyager search failed for ${d.index}`, error);
    return [];
  }
};

let indexByType = async (d: VoyagerIndexInput) => {
  try {
    if (!voyager) return;

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
  try {
    if (!voyager) return;

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

export let isSearchEnabled = () => !!voyager;

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

export let searchSandboxImageIds = async (d: { tenantId: string; query: string }) =>
  await searchByIndex({
    index: 'sandboxImage',
    instanceId: d.tenantId,
    query: d.query
  });

export let searchSandboxMachineIds = async (d: { instanceId: string; query: string }) =>
  await searchByIndex({
    index: 'sandboxMachine',
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
      resolutionMessage: d.resolutionMessage ?? undefined,
      requesterName: d.requesterName ?? undefined,
      requesterEmail: d.requesterEmail ?? undefined,
      providerName: d.providerName ?? undefined,
      providerDescription: d.providerDescription ?? undefined
    }
  });

export let indexProviderTemplateDocument = async (d: ProviderTemplateIndexInput) =>
  await indexByType({
    index: 'providerTemplate',
    id: d.id,
    instanceId: d.instanceId,
    fields: {
      providerTemplateId: d.id,
      status: d.status
    },
    body: {
      id: d.id,
      status: d.status,
      name: d.name,
      description: d.description ?? undefined
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

export let indexSandboxImageDocument = async (d: SandboxImageIndexInput) =>
  await indexByType({
    index: 'sandboxImage',
    id: d.id,
    instanceId: d.tenantId,
    fields: {
      sandboxImageId: d.id
    },
    body: {
      id: d.id,
      name: d.name ?? undefined,
      identifier: d.identifier ?? undefined
    }
  });

export let indexSandboxMachineDocument = async (d: SandboxMachineIndexInput) =>
  await indexByType({
    index: 'sandboxMachine',
    id: d.id,
    instanceId: d.instanceId,
    fields: {
      sandboxMachineId: d.id
    },
    body: {
      id: d.id,
      name: d.name ?? undefined,
      slug: d.slug
    }
  });

export let deleteSandboxImageDocument = async (d: { id: string }) =>
  await deleteByType({
    index: 'sandboxImage',
    id: d.id
  });

export let deleteSandboxMachineDocument = async (d: { id: string }) =>
  await deleteByType({
    index: 'sandboxMachine',
    id: d.id
  });

export let searchSandboxDiskIds = async (d: { instanceId: string; query: string }) =>
  await searchByIndex({ index: 'sandboxDisk', instanceId: d.instanceId, query: d.query });

export let indexSandboxDiskDocument = async (d: SandboxDiskIndexInput) =>
  await indexByType({
    index: 'sandboxDisk',
    id: d.id,
    instanceId: d.instanceId,
    fields: { sandboxDiskId: d.id },
    body: { id: d.id, name: d.name ?? undefined }
  });

export let deleteSandboxDiskDocument = async (d: { id: string }) =>
  await deleteByType({ index: 'sandboxDisk', id: d.id });

export let searchFirewallIds = async (d: { instanceId: string; query: string }) =>
  await searchByIndex({ index: 'firewall', instanceId: d.instanceId, query: d.query });

export let indexFirewallDocument = async (d: {
  id: string;
  instanceId: string;
  name: string;
  description?: string | null;
}) =>
  await indexByType({
    index: 'firewall',
    id: d.id,
    instanceId: d.instanceId,
    fields: { firewallId: d.id },
    body: { name: d.name, description: d.description ?? undefined }
  });

export let deleteFirewallDocument = async (d: { id: string }) =>
  await deleteByType({ index: 'firewall', id: d.id });
