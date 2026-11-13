import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Organization } from '@mtsrc/agent-tracking-db';
import { resolveQueryScope, type QueryScope } from '@mtsrc/agent-tracking-module-usage';
import { getStore, isStoreConfigured } from '@mtsrc/agent-tracking-store';
import {
  buildSessionPipeline,
  buildTopSessionsQuery,
  finalizeSessionGroups,
  validateSessionQuery,
  type SessionGroupRow,
  type SessionQuery
} from '../lib/sessionQueryPipeline';

let queryTimeoutMs = 30_000;

let decimal = (value: unknown) =>
  value === undefined || value === null ? null : Number.parseFloat(String(value));

class SessionQueryServiceImpl {
  async querySessions(d: {
    organization: Organization;
    scope?: QueryScope;
    query: Omit<SessionQuery, 'organizationId' | 'projectIds' | 'instanceIds'>;
  }) {
    let scope = await resolveQueryScope({ organization: d.organization, scope: d.scope });
    let query: SessionQuery = { ...d.query, ...scope, organizationId: d.organization.id };
    validateSessionQuery(query);

    let collections = await this.collections();
    let top = buildTopSessionsQuery(query);

    let [rows, topSessions] = await Promise.all([
      collections.sessions
        .aggregate<SessionGroupRow>(buildSessionPipeline(query), { maxTimeMS: queryTimeoutMs })
        .toArray(),
      top
        ? collections.sessions
            .find(top.filter, {
              projection: {
                _id: 1,
                instanceId: 1,
                startedAt: 1,
                client: 1,
                'observed.userId': 1,
                'observed.agentId': 1,
                'summary.costUsd': 1,
                'summary.requests': 1,
                'summary.durationMs': 1,
                'summary.turns': 1
              },
              maxTimeMS: queryTimeoutMs
            })
            .sort(top.sort)
            .limit(top.limit)
            .toArray()
        : null
    ]);

    return {
      groups: finalizeSessionGroups(query, rows),
      top:
        topSessions?.map(session => ({
          sessionKey: session._id,
          instanceId: session.instanceId,
          startedAt: session.startedAt,
          client: session.client,
          userId: session.observed?.userId ?? null,
          agentId: session.observed?.agentId ?? null,
          costUsd: decimal(session.summary?.costUsd),
          requests: session.summary?.requests ?? null,
          durationMs: session.summary?.durationMs ?? null,
          turns: session.summary?.turns ?? null
        })) ?? null
    };
  }

  private async collections() {
    if (!isStoreConfigured()) {
      throw new ServiceError(
        preconditionFailedError({ message: 'Session queries need the record store.' })
      );
    }

    let store = getStore();
    await store.ready();

    return store.collections();
  }
}

export let sessionQueryService = Service.create(
  'sessionQueryService',
  () => new SessionQueryServiceImpl()
).build();
