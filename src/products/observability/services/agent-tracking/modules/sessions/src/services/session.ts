import {
  badRequestError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Organization } from '@mtsrc/agent-tracking-db';
import { refreshSessionSummary } from '../lib/settle';
import { getStore, isStoreConfigured } from '@mtsrc/agent-tracking-store';
import type { SessionDocument } from '@mtsrc/agent-tracking-store';

export let sessionStates = ['active', 'idle', 'ended'] as const;

export let defaultSessionPageSize = 25;

export let maxSessionPageSize = 100;

export type SessionListFilters = {
  projectIds?: string[];
  instanceIds?: string[];
  userIds?: string[];
  deviceIds?: string[];
  agentIds?: string[];
  states?: (typeof sessionStates)[number][];
  from?: Date;
  to?: Date;
};

type ListCursor = { startedAt: Date; sessionKey: string };

let encodeCursor = (cursor: ListCursor) =>
  Buffer.from(
    JSON.stringify({ s: cursor.startedAt.toISOString(), k: cursor.sessionKey })
  ).toString('base64url');

let decodeCursor = (value: string): ListCursor => {
  try {
    let parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    let startedAt = new Date(parsed.s);

    if (typeof parsed.k == 'string' && !isNaN(startedAt.getTime())) {
      return { startedAt, sessionKey: parsed.k };
    }
  } catch {}

  throw new ServiceError(badRequestError({ message: 'Invalid session list cursor.' }));
};

let inFilter = (values: string[] | undefined) => (values ? { $in: values } : undefined);

class SessionServiceImpl {
  private async collections() {
    if (!isStoreConfigured()) {
      throw new ServiceError(
        preconditionFailedError({ message: 'Sessions need the record store.' })
      );
    }

    let store = getStore();
    await store.ready();

    return store.collections();
  }

  async getSession(d: { organization: Organization; sessionKey: string }) {
    let { sessions } = await this.collections();

    let session = await sessions.findOne({
      _id: d.sessionKey,
      organizationId: d.organization.id
    });
    if (!session) throw new ServiceError(notFoundError('session', d.sessionKey));

    return await refreshSessionSummary(session);
  }

  async listSessions(d: {
    organization: Organization;
    filters: SessionListFilters;
    limit?: number;
    cursor?: string;
  }) {
    let { sessions } = await this.collections();

    let limit = Math.min(d.limit ?? defaultSessionPageSize, maxSessionPageSize);
    let cursor = d.cursor ? decodeCursor(d.cursor) : undefined;
    let { filters } = d;

    let startedAt = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lt: filters.to } : {})
    };

    let query = Object.fromEntries(
      Object.entries({
        organizationId: d.organization.id,
        projectId: inFilter(filters.projectIds),
        instanceId: inFilter(filters.instanceIds),
        'observed.userId': inFilter(filters.userIds),
        'observed.deviceId': inFilter(filters.deviceIds),
        'observed.agentId': inFilter(filters.agentIds),
        state: inFilter(filters.states),
        startedAt: Object.keys(startedAt).length ? startedAt : undefined,
        ...(cursor
          ? {
              $or: [
                { startedAt: { $lt: cursor.startedAt } },
                { startedAt: cursor.startedAt, _id: { $lt: cursor.sessionKey } }
              ]
            }
          : {})
      }).filter(([, value]) => value !== undefined)
    );

    let found: SessionDocument[] = await sessions
      .find(query, { sort: { startedAt: -1, _id: -1 }, limit: limit + 1 })
      .toArray();

    let items = found.slice(0, limit);
    let last = items[items.length - 1];
    let hasMore = found.length > limit;

    return {
      items,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({ startedAt: last.startedAt, sessionKey: last._id })
          : null
    };
  }
}

export let sessionService = Service.create(
  'sessionService',
  () => new SessionServiceImpl()
).build();
