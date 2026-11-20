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
import type { SessionDocument, StoreCollections } from '@mtsrc/agent-tracking-store';
import {
  oppositeSide,
  sessionListQuery,
  sessionPagings,
  type PositionedSession,
  type SessionListOrder,
  type SessionListSide,
  type SessionListSort
} from '../lib/listPage';
import { sessionScopeFilter, type SessionListFilters } from '../lib/listFilter';

export let defaultSessionPageSize = 25;

export let maxSessionPageSize = 100;

export { sessionListOrders, sessionListQuery, sessionListSorts } from '../lib/listPage';

export { sessionStates } from '../lib/listFilter';

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

  // A position holds the anchor's last activity as it was read, so an anchor that moves does
  // not shift the next page.
  async listSessions(d: {
    organization: Organization;
    filters: SessionListFilters;
    limit?: number;
    order?: SessionListOrder;
    orderBy?: SessionListSort;
    after?: string;
    before?: string;
  }) {
    if (d.after !== undefined && d.before !== undefined) {
      throw new ServiceError(
        badRequestError({ message: 'Pass only one of after and before.' })
      );
    }

    let { sessions } = await this.collections();

    let limit = Math.min(d.limit ?? defaultSessionPageSize, maxSessionPageSize);
    let order = d.order ?? 'desc';
    let orderBy = d.orderBy ?? 'lastActivity';
    let paging = sessionPagings[orderBy];
    let side: SessionListSide = d.before !== undefined ? 'before' : 'after';
    let page = { organization: d.organization, filters: d.filters, order, orderBy };

    let anchor = d.after ?? d.before;
    let position =
      anchor === undefined
        ? undefined
        : (paging.read(anchor) ??
          paging.positionOf(await this.anchorSession(sessions, d, anchor)));

    let { filter, sort } = sessionListQuery({ ...page, side, position });
    let found: SessionDocument[] = await sessions
      .find(filter, { sort, limit: limit + 1 })
      .toArray();

    let more = found.length > limit;
    let items = found.slice(0, limit);
    if (side == 'before') items.reverse();

    let beyond = false;
    if (position) {
      let opposite = sessionListQuery({
        ...page,
        side: oppositeSide(side),
        position,
        inclusive: true
      });
      beyond = !!(await sessions.findOne(opposite.filter, {
        projection: { _id: 1 },
        sort: opposite.sort
      }));
    }

    let hasMoreAfter = side == 'after' ? more : beyond;
    let hasMoreBefore = side == 'before' ? more : beyond;
    let first = items[0];
    let last = items[items.length - 1];

    return {
      items,
      hasMoreAfter,
      hasMoreBefore,
      after: hasMoreAfter && last ? paging.cursorOf(last) : undefined,
      before: hasMoreBefore && first ? paging.cursorOf(first) : undefined
    };
  }

  // Scoped like the list, so a limited caller cannot probe other keys. An unknown key is an
  // error, not an empty page.
  private async anchorSession(
    sessions: StoreCollections['sessions'],
    d: { organization: Organization; filters: SessionListFilters },
    sessionKey: string
  ): Promise<PositionedSession> {
    let anchor = await sessions.findOne(
      {
        _id: sessionKey,
        ...sessionScopeFilter(d.organization, d.filters)
      },
      { projection: { _id: 1, lastActivityAt: 1, 'summary.costUsd': 1 } }
    );
    if (!anchor) {
      throw new ServiceError(badRequestError({ message: 'Unknown session list anchor.' }));
    }

    return anchor;
  }
}

export let sessionService = Service.create(
  'sessionService',
  () => new SessionServiceImpl()
).build();
