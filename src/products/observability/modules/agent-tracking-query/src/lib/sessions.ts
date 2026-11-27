import { notFoundError, ServiceError } from '@lowerdeck/error';
import type { AgentTracking } from '@metorial/module-agent-tracking-sync';
import { unique } from './entities';
import { unknownMemberKey } from './members';
import { maxRangeDays } from './range';
import type { SessionListOrderBy } from './types';

export let sessionIdPrefix = 'atse_';

export let sessionListOrderBys = [
  'last_activity',
  'cost'
] as const satisfies readonly SessionListOrderBy[];

export let serviceOrderBy = { last_activity: 'lastActivity', cost: 'cost' } as const;

let usagePaddingMs = 15 * 60 * 1000;

let dayMs = 24 * 60 * 60 * 1000;

export type RemoteSession = Awaited<
  ReturnType<AgentTracking['session']['list']>
>['items'][number];

export let sessionIdOf = (sessionKey: string) => `${sessionIdPrefix}${sessionKey}`;

export let sessionAnchorOf = (anchor: string | undefined) =>
  anchor?.startsWith(sessionIdPrefix) ? anchor.slice(sessionIdPrefix.length) : anchor;

export let unknownToNull = (ids: string[] | undefined) =>
  ids ? [...new Set(ids)].sort().map(id => (id == unknownMemberKey ? null : id)) : undefined;

export let sessionUsageRange = (session: { startedAt: Date; lastActivityAt: Date }) => {
  let to = new Date(new Date(session.lastActivityAt).getTime() + usagePaddingMs);
  let from = new Date(
    Math.max(
      new Date(session.startedAt).getTime() - usagePaddingMs,
      to.getTime() - maxRangeDays * dayMs
    )
  );

  return { from, to };
};

export let sessionNotFound = (sessionId: string) =>
  new ServiceError(notFoundError('agent_tracking.session', sessionId));

export let sessionKeyOf = (sessionId: string) => {
  if (!sessionId.startsWith(sessionIdPrefix)) throw sessionNotFound(sessionId);

  return sessionId.slice(sessionIdPrefix.length);
};

export let unknownModelNamesOf = (session: Pick<RemoteSession, 'summary'>) =>
  unique(
    (session.summary?.models ?? [])
      .filter(model => !model.modelId)
      .flatMap(model => model.rawIds)
  );
