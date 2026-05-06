import {
  db,
  ID,
  Instance,
  MagicMcpEndpoint,
  MagicMcpServer,
  Prisma,
  ProviderTemplate
} from '@metorial/db';
import { subspaceMagicMcpBackingService } from '@metorial/module-subspace';

let magicMcpEndpointBackingInclude = {
  consumerProfile: true,
  servers: {
    include: {
      magicMcpServer: true
    }
  }
} satisfies Prisma.MagicMcpEndpointInclude;

type MagicMcpEndpointWithBackingRelations = Prisma.MagicMcpEndpointGetPayload<{
  include: typeof magicMcpEndpointBackingInclude;
}>;

type ConsumerOwner = {
  identityActorId?: string | null;
  identityId?: string | null;
};

let getMagicMcpSessionDuration = async (instance: Instance) => {
  let project = await db.project.findUniqueOrThrow({
    where: { oid: instance.projectOid },
    select: { magicMcpSessionDurationMinutes: true }
  });

  return project.magicMcpSessionDurationMinutes;
};

let getConsumerOwnerForProfile = async (d: {
  instance: Instance;
  consumerProfileOid?: bigint | null;
}): Promise<ConsumerOwner> => {
  if (!d.consumerProfileOid) return {};

  let actor = await db.consumerActor.findFirst({
    where: {
      instanceOid: d.instance.oid,
      consumerProfileOid: d.consumerProfileOid,
      isDefault: true
    },
    select: {
      id: true,
      defaultIdentityId: true
    }
  });

  return {
    identityActorId: actor?.id ?? null,
    identityId: actor?.defaultIdentityId ?? null
  };
};

let getConsumerOwnerForServer = async (d: {
  instance: Instance;
  server: Pick<MagicMcpServer, 'oid'>;
}): Promise<ConsumerOwner> => {
  let owner = await db.consumerIntegration.findFirst({
    where: {
      instanceOid: d.instance.oid,
      magicMcpServerOid: d.server.oid,
      isManaged: true
    },
    select: {
      consumerProfileOid: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  return await getConsumerOwnerForProfile({
    instance: d.instance,
    consumerProfileOid: owner?.consumerProfileOid
  });
};

let toBackingToolFilter = (toolFilter: unknown) => {
  if (!toolFilter) return null;

  return toolFilter;
};

export let ensureProviderTemplateBacking = async (d: {
  instance: Instance;
  providerTemplate: ProviderTemplate;
  providers?: {
    providerId: string;
    providerDeploymentId?: string | null;
    providerAuthMethodId?: string | null;
    providerAuthCredentialsId?: string | null;
    providerConfigId?: string | null;
    name?: string;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
    toolFilters?: any;
  }[];
  toolFilters?: any;
}) => {
  let backing = await subspaceMagicMcpBackingService.reconcileProviderTemplate({
    instance: d.instance,
    providerTemplateId: d.providerTemplate.id,
    name: d.providerTemplate.name,
    description: d.providerTemplate.description,
    metadata: d.providerTemplate.metadata as Record<string, any>,
    providers: d.providers,
    ...(d.toolFilters !== undefined ? { toolFilters: d.toolFilters } : {})
  });

  if (
    !d.providerTemplate.hasSubspaceBacking ||
    d.providerTemplate.subspaceIntegrationId !== backing.integrationId
  ) {
    return await db.providerTemplate.update({
      where: { oid: d.providerTemplate.oid },
      data: {
        hasSubspaceBacking: true,
        subspaceIntegrationId: backing.integrationId
      }
    });
  }

  return d.providerTemplate;
};

export let ensureMagicMcpServerBacking = async (d: {
  instance: Instance;
  server: MagicMcpServer;
  providers?: {
    providerDeploymentId: string;
    providerConfigId?: string | null;
    providerAuthConfigId?: string | null;
    toolFilters?: any;
  }[];
  isReconciliation?: boolean;
}) => {
  let owner = await getConsumerOwnerForServer({
    instance: d.instance,
    server: d.server
  });
  let providerTemplateBackingId: string | null = null;
  if (d.server.providerTemplateId) {
    let providerTemplate = await db.providerTemplate.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.server.providerTemplateId
      }
    });
    if (providerTemplate) {
      await ensureProviderTemplateBacking({ instance: d.instance, providerTemplate });
      providerTemplateBackingId = providerTemplate.id;
    }
  }

  let providers = d.providers ?? undefined;
  let maxSessionDurationInMinutes = await getMagicMcpSessionDuration(d.instance);
  let backing = await subspaceMagicMcpBackingService.upsertServer({
    instance: d.instance,
    magicMcpServerBackingId: d.server.id,
    providerTemplateBackingId,
    ownerIntegrationInstanceId: d.server.subspaceIntegrationInstanceId,
    name: d.server.name,
    description: d.server.description,
    metadata: d.server.metadata as Record<string, any>,
    maxSessionDurationInMinutes,
    isReconciliation: d.isReconciliation,
    legacySessionTemplateId: d.server.legacySubspaceSessionTemplateId,
    ...owner,
    ...(providers?.length ? { providers } : {})
  });

  return await db.magicMcpServer.update({
    where: { oid: d.server.oid },
    data: {
      hasSubspaceBacking: true,
      ownerType: backing.ownerType,
      subspaceEphemeralManagedSessionId: backing.ephemeralManagedSessionId
    }
  });
};

let ensureEndpointServerIds = async (endpoint: Pick<MagicMcpEndpoint, 'oid'>) => {
  let rows = await db.magicMcpEndpointServer.findMany({
    where: {
      magicMcpEndpointOid: endpoint.oid
    },
    select: {
      oid: true,
      id: true
    }
  });

  for (let row of rows) {
    if (row.id) continue;

    await db.magicMcpEndpointServer.update({
      where: { oid: row.oid },
      data: { id: await ID.generateId('magicMcpEndpoint') }
    });
  }
};

export let ensureMagicMcpEndpointBacking = async (d: {
  instance: Instance;
  endpoint: MagicMcpEndpointWithBackingRelations;
  isReconciliation?: boolean;
}) => {
  await ensureEndpointServerIds(d.endpoint);

  let endpoint = await db.magicMcpEndpoint.findUniqueOrThrow({
    where: { oid: d.endpoint.oid },
    include: magicMcpEndpointBackingInclude
  });

  for (let server of endpoint.servers) {
    await ensureMagicMcpServerBacking({
      instance: d.instance,
      server: server.magicMcpServer,
      isReconciliation: d.isReconciliation
    });
  }

  let owner = await getConsumerOwnerForProfile({
    instance: d.instance,
    consumerProfileOid: endpoint.consumerProfileOid
  });
  let maxSessionDurationInMinutes = await getMagicMcpSessionDuration(d.instance);
  let backing = await subspaceMagicMcpBackingService.upsertEndpoint({
    instance: d.instance,
    magicMcpEndpointBackingId: endpoint.id,
    name: endpoint.name,
    description: endpoint.description,
    metadata: endpoint.metadata as Record<string, any>,
    maxSessionDurationInMinutes,
    isReconciliation: d.isReconciliation,
    ...owner,
    servers: endpoint.servers.map(server => ({
      id: server.id!,
      magicMcpServerBackingId: server.magicMcpServer.id,
      toolFilters: toBackingToolFilter(server.toolFilters)
    }))
  });

  return await db.magicMcpEndpoint.update({
    where: { oid: endpoint.oid },
    data: {
      hasSubspaceBacking: true,
      subspaceEphemeralManagedSessionId: backing.ephemeralManagedSessionId
    },
    include: magicMcpEndpointBackingInclude
  });
};
