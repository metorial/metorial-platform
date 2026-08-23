import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import {
  db,
  type Environment,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { sessionTemplateProviderService } from '@metorial-subspace/module-session';
import { enqueueSessionTemplateSyncHash } from '@metorial-subspace/module-session/src/queues/lifecycle/sessionTemplateProvider';
import { env } from '../../env';
import { integrationInstanceGroupProviderService } from '../../services/integrationInstanceGroupProvider';
import { reconcileMagicMcpServerProvidersForBackingWithoutLock } from '../../services/magicMcpBacking/serverProvider';

export type MagicMcpBackingReconcileInput = {
  tenantId: string;
  solutionId: string;
  environmentId: string;
} & (
  | { kind: 'server'; magicMcpServerBackingId: string }
  | { kind: 'endpoint'; magicMcpEndpointBackingId: string }
);

export let magicMcpBackingReconcileQueue = createQueue<MagicMcpBackingReconcileInput>({
  name: 'sub/int/magicMcpBacking/reconcile',
  redisUrl: env.service.REDIS_URL
});

let loadScope = async (d: { tenantId: string; solutionId: string; environmentId: string }) => {
  let environment = await db.environment.findFirst({
    where: {
      id: d.environmentId,
      tenant: { OR: [{ id: d.tenantId }, { identifier: d.tenantId }] }
    },
    include: {
      tenant: true
    }
  });
  if (!environment) throw new QueueRetryError();
  let solution = await db.solution.findFirst({
    where: {
      OR: [{ id: d.solutionId }, { identifier: d.solutionId }]
    }
  });
  if (!solution) throw new QueueRetryError();

  return {
    tenant: environment.tenant,
    solution,
    environment
  };
};

export let enqueueMagicMcpServerBackingReconcile = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  magicMcpServerBackingId: string;
}) => {
  await magicMcpBackingReconcileQueue.add({
    kind: 'server',
    tenantId: d.tenant.id,
    solutionId: d.solution.id,
    environmentId: d.environment.id,
    magicMcpServerBackingId: d.magicMcpServerBackingId
  });
};

export let enqueueMagicMcpEndpointBackingReconcile = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  magicMcpEndpointBackingId: string;
}) => {
  await magicMcpBackingReconcileQueue.add({
    kind: 'endpoint',
    tenantId: d.tenant.id,
    solutionId: d.solution.id,
    environmentId: d.environment.id,
    magicMcpEndpointBackingId: d.magicMcpEndpointBackingId
  });
};

export let reconcileMagicMcpServerBacking = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  magicMcpServerBackingId: string;
}) => {
  let backing = await db.magicMcpServerBacking.findFirst({
    where: {
      id: d.magicMcpServerBackingId,
      integrationInstance: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      }
    },
    include: {
      integrationInstance: true,
      sessionTemplate: true,
      ephemeralManagedSession: true
    }
  });
  if (!backing) throw new QueueRetryError();

  try {
    await sessionTemplateProviderService.syncForIntegrationInstance({
      sessionTemplate: backing.sessionTemplate,
      integrationInstance: backing.integrationInstance
    });
    await enqueueSessionTemplateSyncHash(backing.sessionTemplate.id);

    await reconcileMagicMcpServerProvidersForBackingWithoutLock({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      magicMcpServerBackingId: d.magicMcpServerBackingId
    });
  } finally {
    await db.ephemeralManagedSession.update({
      where: { oid: backing.ephemeralManagedSessionOid },
      data: { isReconciling: false }
    });
  }
};

export let reconcileMagicMcpEndpointBacking = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  magicMcpEndpointBackingId: string;
}) => {
  let backing = await db.magicMcpEndpointBacking.findFirst({
    where: {
      id: d.magicMcpEndpointBackingId,
      integrationGroup: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      }
    },
    include: {
      integrationGroup: true,
      sessionTemplate: true,
      ephemeralManagedSession: true,
      servers: {
        include: {
          magicMcpServerBacking: {
            include: {
              integrationInstance: {
                include: {
                  integrationInstanceProviders: {
                    where: { status: 'active', isParentDeleted: false },
                    include: { currentVersion: true }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
  if (!backing) throw new QueueRetryError();

  try {
    let input = backing.servers.flatMap(serverBacking => {
      return serverBacking.magicMcpServerBacking.integrationInstance.integrationInstanceProviders
        .filter(provider => provider.currentVersion?.configOid)
        .map(provider => ({
          integrationInstanceProviderId: provider.id,
          toolFilters: serverBacking.toolFilters as PrismaJson.ToolFilter | null
        }));
    });

    await integrationInstanceGroupProviderService.syncMagicMcpIntegrationInstanceGroupProvidersInternal(
      {
        tenant: d.tenant,
        environment: d.environment,
        integrationInstanceGroup: backing.integrationGroup,
        input
      }
    );

    await sessionTemplateProviderService.syncForIntegrationInstanceGroup({
      sessionTemplate: backing.sessionTemplate,
      integrationInstanceGroup: backing.integrationGroup
    });
    await enqueueSessionTemplateSyncHash(backing.sessionTemplate.id);
  } finally {
    await db.ephemeralManagedSession.update({
      where: { oid: backing.ephemeralManagedSessionOid },
      data: { isReconciling: false }
    });
  }
};

export let magicMcpBackingReconcileQueueProcessor = magicMcpBackingReconcileQueue.process(
  async data => {
    let scope = await loadScope(data);

    if (data.kind === 'server') {
      await reconcileMagicMcpServerBacking({
        ...scope,
        magicMcpServerBackingId: data.magicMcpServerBackingId
      });
      return;
    }

    await reconcileMagicMcpEndpointBacking({
      ...scope,
      magicMcpEndpointBackingId: data.magicMcpEndpointBackingId
    });
  }
);
