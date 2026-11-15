import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Entity, Organization } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';
import { recordErasureService } from '@mtsrc/agent-tracking-module-records';
import { usageErasureService } from '@mtsrc/agent-tracking-module-usage';
import { getStore, isStoreConfigured } from '@mtsrc/agent-tracking-store';
import { eraseUserQueue, revokeUserTokens } from '../queues/eraseUser';

class UserErasureServiceImpl {
  // Tokens are revoked before the job is queued, so nothing new arrives for the user while the
  // erasure runs.
  async eraseUser(d: { organization: Organization; user: Entity }) {
    if (d.user.kind != 'user') {
      throw new ServiceError(
        badRequestError({ message: `The entity ${d.user.id} is not a user.` })
      );
    }

    await revokeUserTokens({ userEntityOid: d.user.oid });

    await eraseUserQueue.add({
      organizationId: d.organization.id,
      userId: d.user.id,
      phase: 'registry'
    });
  }

  async getUserErasureStatus(d: { organization: Organization; userId: string }) {
    let user = await db.entity.findFirst({
      where: { id: d.userId, organizationOid: d.organization.oid },
      select: { oid: true }
    });

    let scope = { organizationId: d.organization.id, userId: d.userId };

    let records = false;
    let sessions = false;
    let slices = false;

    if (isStoreConfigured()) {
      let store = getStore();
      await store.ready();

      records = await recordErasureService.hasUserRecords(scope);
      sessions = !!(await store
        .collections()
        .sessions.findOne(
          { organizationId: d.organization.id, 'observed.userId': d.userId },
          { projection: { _id: 1 } }
        ));
      slices = await usageErasureService.hasUserSlices(scope);
    }

    let remaining = { registry: !!user, records, sessions, slices };

    return {
      userId: d.userId,
      complete: !Object.values(remaining).some(Boolean),
      remaining
    };
  }
}

export let userErasureService = Service.create(
  'userErasureService',
  () => new UserErasureServiceImpl()
).build();
