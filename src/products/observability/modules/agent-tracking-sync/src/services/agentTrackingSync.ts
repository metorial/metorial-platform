import { Service } from '@lowerdeck/service';
import type { Organization } from '@metorial/db';
import { backfillOrganizationQueue } from '../queues/backfill';
import { reconcileSingleQueue } from '../queues/reconcile';
import { syncEntityQueue, type EntitySyncTarget } from '../queues/syncEntity';

// A process caches flags for up to 35 seconds, and a stale read can sit in the shared cache
// for 5 minutes.
let flagChangeReconcileDelays = {
  settled: 60_000,
  cache_expired: 6 * 60_000
};

class AgentTrackingSyncServiceImpl {
  async syncEntities(d: { entities: EntitySyncTarget[] }) {
    await syncEntityQueue.addMany(d.entities);
  }

  async backfillRoster(d: { organization: Pick<Organization, 'id'> }) {
    await backfillOrganizationQueue.add(
      { organizationId: d.organization.id },
      { id: d.organization.id }
    );
  }

  async reconcileOrganization(d: { organization: Pick<Organization, 'id'> }) {
    await reconcileSingleQueue.addManyWithOps(
      Object.entries(flagChangeReconcileDelays).map(([name, delay]) => ({
        data: { organizationId: d.organization.id, backfillRoster: true },
        opts: { delay, id: `${d.organization.id}_reconcile_${name}` }
      }))
    );
  }
}

export let agentTrackingSyncService = Service.create(
  'agentTrackingSyncService',
  () => new AgentTrackingSyncServiceImpl()
).build();
