import {
  badRequestError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Organization } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';
import { getStore, isStoreConfigured } from '@mtsrc/agent-tracking-store';
import type { ManualAssignment } from '@mtsrc/agent-tracking-store';
import { attributionService } from '@mtsrc/agent-tracking-module-attribution';
import { isEntityInScope } from '@mtsrc/agent-tracking-module-attribution';
import { reattributeSession } from '../lib/reattribute';

let senderKinds = ['user', 'device'];

class SessionAttributionServiceImpl {
  async assignSession(d: {
    organization: Organization;
    sessionKey: string;
    kind: string;
    entityId: string | null;
  }) {
    let sessions = await this.sessions();

    let session = await sessions.findOne({
      _id: d.sessionKey,
      organizationId: d.organization.id
    });
    if (!session) throw new ServiceError(notFoundError('session', d.sessionKey));

    let context = await attributionService.getContext({ organizationId: d.organization.id });
    if (!context.kinds.has(d.kind))
      throw new ServiceError(notFoundError('entity_kind', d.kind));
    if (senderKinds.includes(d.kind)) {
      throw new ServiceError(
        badRequestError({ message: `The ${d.kind} of a session comes from its sender.` })
      );
    }

    if (d.entityId) {
      let entity = await db.entity.findFirst({
        where: { id: d.entityId, organizationOid: d.organization.oid },
        include: { scopeProject: true, scopeInstance: true }
      });
      if (!entity) throw new ServiceError(notFoundError('entity', d.entityId));

      if (entity.kind != d.kind) {
        throw new ServiceError(
          badRequestError({ message: `The entity ${entity.id} is a ${entity.kind}.` })
        );
      }
      if (entity.status != 'managed' && entity.status != 'discovered') {
        throw new ServiceError(
          badRequestError({ message: `The entity ${entity.id} is ${entity.status}.` })
        );
      }

      let inScope = isEntityInScope(
        {
          scopeProjectId: entity.scopeProject?.id ?? null,
          scopeInstanceId: entity.scopeInstance?.id ?? null
        },
        session
      );
      if (!inScope) {
        throw new ServiceError(
          badRequestError({ message: `The entity ${entity.id} is limited to another scope.` })
        );
      }
    }

    let manual: ManualAssignment[] = [
      ...(session.manual ?? []).filter(assignment => assignment.kind != d.kind),
      ...(d.entityId ? [{ kind: d.kind, entityId: d.entityId, at: new Date() }] : [])
    ];

    await sessions.updateOne({ _id: session._id }, { $set: { manual } });

    let result = await reattributeSession({ sessionKey: session._id });

    return result?.session ?? { ...session, manual };
  }

  async reattribute(d: { sessionKey: string; organizationId?: string; force?: boolean }) {
    return await reattributeSession(d);
  }

  private async sessions() {
    if (!isStoreConfigured()) {
      throw new ServiceError(
        preconditionFailedError({ message: 'Sessions need the record store.' })
      );
    }

    let store = getStore();
    await store.ready();

    return store.collections().sessions;
  }
}

export let sessionAttributionService = Service.create(
  'sessionAttributionService',
  () => new SessionAttributionServiceImpl()
).build();
