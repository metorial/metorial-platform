import {
  db,
  ID,
  Instance,
  MagicMcpEndpoint,
  MagicMcpServer,
  Prisma,
  ProviderTemplate
} from '@metorial/db';
import {
  subspaceIntegrationInstanceService,
  subspaceMagicMcpBackingService
} from '@metorial/module-subspace';

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

export type ConsumerOwner = {
  identityActorId?: string | null;
  identityId?: string | null;
};

let localBackingLocks = new Map<string, Promise<unknown>>();

let withLocalBackingLock = async <T>(key: string, cb: () => Promise<T>) => {
  let previous = localBackingLocks.get(key) ?? Promise.resolve();
  let current: Promise<T>;
  current = previous
    .catch(() => {})
    .then(cb)
    .finally(() => {
      if (localBackingLocks.get(key) === current) {
        localBackingLocks.delete(key);
      }
    });

  localBackingLocks.set(key, current);

  return await current;
};

let getMagicMcpSessionDuration = async (instance: Instance) => {
  let project = await db.project.findUniqueOrThrow({
    where: { oid: instance.projectOid },
    select: { magicMcpSessionDurationMinutes: true }
  });

  return project.magicMcpSessionDurationMinutes;
};

let BACKING_READY_POLL_INTERVAL_MS = 100;
let BACKING_READY_CONNECT_ATTEMPTS = 20;
let BACKING_READY_WORKER_ATTEMPTS = 600;

let wait = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
}) =>
  withLocalBackingLock(`provider-template:${d.providerTemplate.id}`, async () => {
    let backing = await subspaceMagicMcpBackingService.reconcileProviderTemplate({
      instance: d.instance,
      providerTemplateId: d.providerTemplate.id,
      name: d.providerTemplate.name,
      description: d.providerTemplate.description,
      metadata: d.providerTemplate.metadata as Record<string, any>,
      providerDeploymentId: d.providerTemplate.legacyProviderDeploymentId,
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
  });

export let ensureProviderTemplateBackingFromIntegration = async (d: {
  instance: Instance;
  providerTemplateId: string;
  integrationId: string;
}) =>
  withLocalBackingLock(
    `provider-template-integration:${d.integrationId}`,
    async () =>
      await subspaceMagicMcpBackingService.upsertProviderTemplateFromIntegration({
        instance: d.instance,
        providerTemplateId: d.providerTemplateId,
        integrationId: d.integrationId
      })
  );

export let ensureMagicMcpServerBacking = async (d: {
  instance: Instance;
  server: MagicMcpServer;
  owner?: ConsumerOwner;
  providers?: {
    providerDeploymentId: string;
    providerConfigId?: string | null;
    providerAuthConfigId?: string | null;
    toolFilters?: any;
  }[];
  isReconciliation?: boolean;
  deferReconcile?: boolean;
}) =>
  withLocalBackingLock(`server:${d.server.id}`, async () => {
    let [owner, maxSessionDurationInMinutes] = await Promise.all([
      d.owner ??
        getConsumerOwnerForServer({
          instance: d.instance,
          server: d.server
        }),
      getMagicMcpSessionDuration(d.instance)
    ]);
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
    let ownerIntegrationId: string | null = null;
    if (d.server.subspaceIntegrationInstanceId && !providerTemplateBackingId) {
      let integrationInstance = await subspaceIntegrationInstanceService.get({
        instance: d.instance,
        integrationInstanceId: d.server.subspaceIntegrationInstanceId
      });
      ownerIntegrationId = integrationInstance.integrationId;
    }

    let providers = d.providers ?? undefined;
    let backing = await subspaceMagicMcpBackingService.upsertServer({
      instance: d.instance,
      magicMcpServerBackingId: d.server.id,
      providerTemplateBackingId,
      ownerIntegrationId,
      ownerIntegrationInstanceId: d.server.subspaceIntegrationInstanceId,
      name: d.server.name,
      description: d.server.description,
      metadata: d.server.metadata as Record<string, any>,
      maxSessionDurationInMinutes,
      isReconciliation: d.isReconciliation,
      deferReconcile: d.deferReconcile,
      legacySessionTemplateId: d.server.legacySubspaceSessionTemplateId,
      ...owner,
      ...(providers?.length ? { providers } : {})
    });

    return await db.magicMcpServer.update({
      where: { oid: d.server.oid },
      data: {
        hasSubspaceBacking: true,
        ownerType: backing.ownerType,
        subspaceEphemeralManagedSessionId: backing.ephemeralManagedSessionId,
        isSubspaceBackingReconciling: backing.isReconciling
      }
    });
  });

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
  deferReconcile?: boolean;
}) =>
  withLocalBackingLock(`endpoint:${d.endpoint.id}`, async () => {
    await ensureEndpointServerIds(d.endpoint);

    let endpoint = await db.magicMcpEndpoint.findUniqueOrThrow({
      where: { oid: d.endpoint.oid },
      include: magicMcpEndpointBackingInclude
    });

    let owner = await getConsumerOwnerForProfile({
      instance: d.instance,
      consumerProfileOid: endpoint.consumerProfileOid
    });

    for (let server of endpoint.servers) {
      let ensuredServer = await ensureMagicMcpServerBacking({
        instance: d.instance,
        server: server.magicMcpServer,
        ...(endpoint.consumerProfileOid ? { owner } : {}),
        isReconciliation: d.isReconciliation,
        deferReconcile: d.deferReconcile
      });
      if (d.deferReconcile !== false) {
        await waitForMagicMcpServerBackingReady({
          instance: d.instance,
          server: ensuredServer,
          attempts: BACKING_READY_WORKER_ATTEMPTS
        });
      }
    }

    let maxSessionDurationInMinutes = await getMagicMcpSessionDuration(d.instance);
    let backing = await subspaceMagicMcpBackingService.upsertEndpoint({
      instance: d.instance,
      magicMcpEndpointBackingId: endpoint.id,
      name: endpoint.name,
      description: endpoint.description,
      metadata: endpoint.metadata as Record<string, any>,
      maxSessionDurationInMinutes,
      isReconciliation: d.isReconciliation,
      deferReconcile: d.deferReconcile,
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
        subspaceEphemeralManagedSessionId: backing.ephemeralManagedSessionId,
        isSubspaceBackingReconciling: backing.isReconciling
      },
      include: magicMcpEndpointBackingInclude
    });
  });

export let waitForMagicMcpServerBackingReady = async (d: {
  instance: Instance;
  server: Pick<MagicMcpServer, 'oid' | 'id'>;
  attempts?: number;
}) => {
  let latest: MagicMcpServer | null = null;

  for (let attempt = 0; attempt < (d.attempts ?? BACKING_READY_CONNECT_ATTEMPTS); attempt++) {
    latest = await db.magicMcpServer.findUnique({
      where: { oid: d.server.oid }
    });
    if (!latest) return null;

    if (
      latest.hasSubspaceBacking &&
      latest.subspaceEphemeralManagedSessionId &&
      latest.isSubspaceBackingReconciling
    ) {
      try {
        let backing = await subspaceMagicMcpBackingService.getServer({
          instance: d.instance,
          magicMcpServerBackingId: latest.id
        });
        if (!backing.isReconciling) {
          latest = await db.magicMcpServer.update({
            where: { oid: latest.oid },
            data: { isSubspaceBackingReconciling: false }
          });
        }
      } catch {
        // Backing is still being created by the lifecycle queue.
      }
    }

    if (
      latest.hasSubspaceBacking &&
      latest.subspaceEphemeralManagedSessionId &&
      !latest.isSubspaceBackingReconciling
    ) {
      return latest;
    }

    await wait(BACKING_READY_POLL_INTERVAL_MS);
  }

  return latest;
};

export let waitForMagicMcpEndpointBackingReady = async (d: {
  instance: Instance;
  endpoint: Pick<MagicMcpEndpoint, 'oid' | 'id'>;
  attempts?: number;
}) => {
  let latest: MagicMcpEndpointWithBackingRelations | null = null;

  for (let attempt = 0; attempt < (d.attempts ?? BACKING_READY_CONNECT_ATTEMPTS); attempt++) {
    latest = await db.magicMcpEndpoint.findUnique({
      where: { oid: d.endpoint.oid },
      include: magicMcpEndpointBackingInclude
    });
    if (!latest) return null;

    if (
      latest.hasSubspaceBacking &&
      latest.subspaceEphemeralManagedSessionId &&
      latest.isSubspaceBackingReconciling
    ) {
      try {
        let backing = await subspaceMagicMcpBackingService.getEndpoint({
          instance: d.instance,
          magicMcpEndpointBackingId: latest.id
        });
        if (!backing.isReconciling) {
          latest = await db.magicMcpEndpoint.update({
            where: { oid: latest.oid },
            data: { isSubspaceBackingReconciling: false },
            include: magicMcpEndpointBackingInclude
          });
        }
      } catch {
        // Backing is still being created by the lifecycle queue.
      }
    }

    if (
      latest.hasSubspaceBacking &&
      latest.subspaceEphemeralManagedSessionId &&
      !latest.isSubspaceBackingReconciling
    ) {
      return latest;
    }

    await wait(BACKING_READY_POLL_INTERVAL_MS);
  }

  return latest;
};

export let MAGIC_MCP_BACKING_READY_WORKER_ATTEMPTS = BACKING_READY_WORKER_ATTEMPTS;
