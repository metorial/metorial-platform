import mongoose from 'mongoose';
import type { Organization } from '@mtsrc/agent-tracking-db';
import type { SessionDocument } from '@mtsrc/agent-tracking-store';
import { decimalString } from '@mtsrc/agent-tracking-cost';
import { sessionListFilter, type SessionListFilters } from './listFilter';

export let sessionListOrders = ['asc', 'desc'] as const;

export type SessionListOrder = (typeof sessionListOrders)[number];

export let sessionListSorts = ['lastActivity', 'cost'] as const;

export type SessionListSort = (typeof sessionListSorts)[number];

export type SessionListSide = 'after' | 'before';

export type SessionListPosition = { lastActivityAt: Date; sessionKey: string };

export type SessionCostPosition = { costUsd: string | null; sessionKey: string };

type SessionPositions = { lastActivity: SessionListPosition; cost: SessionCostPosition };

export type PositionedSession = Pick<SessionDocument, '_id' | 'lastActivityAt' | 'summary'>;

type PositionFilterInput<Position> = {
  position: Position;
  side: SessionListSide;
  order: SessionListOrder;
  inclusive?: boolean;
};

type SessionPaging<Position> = {
  read: (value: string) => Position | undefined;
  positionOf: (session: PositionedSession) => Position;
  cursorOf: (session: PositionedSession) => string;
  sort: (order: SessionListOrder, side?: SessionListSide) => Record<string, 1 | -1>;
  filter: (d: PositionFilterInput<Position>) => Record<string, unknown>;
};

export let oppositeSide = (side: SessionListSide): SessionListSide =>
  side == 'after' ? 'before' : 'after';

let encodeCursor = (fields: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(fields)).toString('base64url');

let readCursor = (value: string): Record<string, any> | undefined => {
  try {
    let parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    return parsed && typeof parsed == 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
};

// `before` pages are read nearest-first, so the caller reverses them.
let sortOn =
  (path: string) =>
  (order: SessionListOrder, side: SessionListSide = 'after') => {
    let direction: 1 | -1 = (order == 'asc') == (side == 'after') ? 1 : -1;

    return { [path]: direction, _id: direction };
  };

let lastActivityPositionOf = (session: PositionedSession): SessionListPosition => ({
  lastActivityAt: session.lastActivityAt,
  sessionKey: session._id
});

let readLastActivityPosition = (value: string): SessionListPosition | undefined => {
  let parsed = readCursor(value);
  let lastActivityAt = new Date(parsed?.a);

  return typeof parsed?.k == 'string' && !isNaN(lastActivityAt.getTime())
    ? { lastActivityAt, sessionKey: parsed.k }
    : undefined;
};

let lastActivityFilter = (d: PositionFilterInput<SessionListPosition>) => {
  let later = (d.side == 'after') == (d.order == 'asc');
  let strict = later ? '$gt' : '$lt';
  let bound = later ? '$gte' : '$lte';

  return {
    lastActivityAt: { [bound]: d.position.lastActivityAt },
    $or: [
      { lastActivityAt: { [strict]: d.position.lastActivityAt } },
      {
        lastActivityAt: d.position.lastActivityAt,
        _id: { [d.inclusive ? bound : strict]: d.position.sessionKey }
      }
    ]
  };
};

let costPath = 'summary.costUsd';

let costCursorTag = 'cost';

let decimalOf = (value: string) => {
  try {
    return mongoose.Types.Decimal128.fromString(value);
  } catch {
    return undefined;
  }
};

let costPositionOf = (session: PositionedSession): SessionCostPosition => ({
  costUsd: decimalString(session.summary?.costUsd) ?? null,
  sessionKey: session._id
});

let readCostPosition = (value: string): SessionCostPosition | undefined => {
  let parsed = readCursor(value);
  let costUsd = parsed?.c;

  return parsed?.s == costCursorTag &&
    typeof parsed.k == 'string' &&
    (costUsd === null || (typeof costUsd == 'string' && decimalOf(costUsd)))
    ? { costUsd, sessionKey: parsed.k }
    : undefined;
};

let withoutCost = () => ({
  $or: [{ [costPath]: { $exists: false } }, { [costPath]: null }]
});

let costFilter = (d: PositionFilterInput<SessionCostPosition>) => {
  let later = (d.side == 'after') == (d.order == 'asc');
  let keyOp = later ? (d.inclusive ? '$gte' : '$gt') : d.inclusive ? '$lte' : '$lt';
  let key = { _id: { [keyOp]: d.position.sessionKey } };
  let cost = d.position.costUsd === null ? null : decimalOf(d.position.costUsd)!;

  if (cost === null) {
    return later
      ? { $or: [{ $and: [withoutCost(), key] }, { [costPath]: { $ne: null } }] }
      : { $and: [withoutCost(), key] };
  }

  return {
    $or: [
      { [costPath]: { [later ? '$gt' : '$lt']: cost } },
      { [costPath]: cost, ...key },
      ...(later ? [] : [withoutCost()])
    ]
  };
};

export let sessionPagings: {
  [Sort in SessionListSort]: SessionPaging<SessionPositions[Sort]>;
} = {
  lastActivity: {
    read: readLastActivityPosition,
    positionOf: lastActivityPositionOf,
    cursorOf: session => {
      let position = lastActivityPositionOf(session);
      return encodeCursor({
        a: position.lastActivityAt.toISOString(),
        k: position.sessionKey
      });
    },
    sort: sortOn('lastActivityAt'),
    filter: lastActivityFilter
  },
  cost: {
    read: readCostPosition,
    positionOf: costPositionOf,
    cursorOf: session => {
      let position = costPositionOf(session);
      return encodeCursor({ s: costCursorTag, c: position.costUsd, k: position.sessionKey });
    },
    sort: sortOn(costPath),
    filter: costFilter
  }
};

export let sessionListQuery = <Sort extends SessionListSort>(d: {
  organization: Pick<Organization, 'id'>;
  filters: SessionListFilters;
  order: SessionListOrder;
  orderBy: Sort;
  side: SessionListSide;
  position?: SessionPositions[Sort];
  inclusive?: boolean;
}) => {
  let paging: SessionPaging<SessionPositions[Sort]> = sessionPagings[d.orderBy];
  let query = sessionListFilter(d.organization, d.filters);

  return {
    filter: d.position
      ? {
          $and: [
            query,
            paging.filter({
              position: d.position,
              side: d.side,
              order: d.order,
              inclusive: d.inclusive
            })
          ]
        }
      : query,
    sort: paging.sort(d.order, d.side)
  };
};
