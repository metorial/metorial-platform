import { addAfterTransactionHook, withTransaction } from '@metorial-subspace/db';
import { magicMcpBackingReconcileQueue } from '../../queues/lifecycle/magicMcpBackingSync';
import { registerIntegrationTransactionListener } from '../../listeners';
import { syncMagicMcpServerProviderRows } from './serverProviderSync';

let enqueueMemberEndpointSyncs = async (integrationInstanceOid: bigint) =>
  await withTransaction(async db => {
    let serverBackings = await db.magicMcpServerBacking.findMany({
      where: { integrationInstanceOid },
      select: { oid: true }
    });
    if (!serverBackings.length) return;

    let endpointBackings = await db.magicMcpEndpointBacking.findMany({
      where: {
        servers: {
          some: {
            magicMcpServerBackingOid: { in: serverBackings.map(backing => backing.oid) }
          }
        },
        sessionTemplate: { status: 'active' }
      },
      select: {
        id: true,
        integrationGroup: {
          select: {
            tenant: { select: { id: true } },
            solution: { select: { id: true } },
            environment: { select: { id: true } }
          }
        }
      }
    });
    if (!endpointBackings.length) return;

    await addAfterTransactionHook(
      async () =>
        await magicMcpBackingReconcileQueue.addMany(
          endpointBackings.map(backing => ({
            kind: 'endpoint' as const,
            tenantId: backing.integrationGroup.tenant.id,
            solutionId: backing.integrationGroup.solution.id,
            environmentId: backing.integrationGroup.environment.id,
            magicMcpEndpointBackingId: backing.id
          }))
        )
    );
  });

let registered = false;

export let registerMagicMcpBackingListener = () => {
  if (registered) return;
  registered = true;

  registerIntegrationTransactionListener({
    async onEvent(event) {
      if (
        event.kind === 'integrationProvider.created' ||
        event.kind === 'integrationProvider.updated' ||
        event.kind === 'integrationProvider.archived'
      ) {
        await syncMagicMcpServerProviderRows({ integrationOids: [event.integration.oid] });
        return;
      }

      if (
        event.kind === 'integrationInstanceProvider.set' ||
        event.kind === 'integrationInstanceProvider.archived'
      ) {
        await syncMagicMcpServerProviderRows({
          integrationInstanceOids: [event.integrationInstance.oid]
        });
        await enqueueMemberEndpointSyncs(event.integrationInstance.oid);
      }
    }
  });
};

registerMagicMcpBackingListener();
