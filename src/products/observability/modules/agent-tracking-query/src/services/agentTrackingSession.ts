import { isServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { requireAgentTracking, toServiceFamily } from '@metorial/module-agent-tracking-sync';
import { sessionTtlSeconds } from '../lib/cache';
import { clientOf, lookupModelNames } from '../lib/catalog';
import { lookupMembers, unique } from '../lib/members';
import { costOf, countOf, tokensOf } from '../lib/money';
import { loadVisiblePrivacy } from '../lib/privacy';
import { sessionModelsQuery } from '../lib/queries';
import {
  hasRange,
  normalizeRange,
  rangeCacheKey,
  resolveRange,
  type RangeInput
} from '../lib/range';
import { createRemotePaginator } from '../lib/remotePaginator';
import { cachedRead, runUsageQuery, type ReadScope } from '../lib/scope';
import { queryCallOptions } from '../lib/service';
import {
  serviceOrderBy,
  sessionAnchorOf,
  sessionIdOf,
  sessionIdPrefix,
  sessionNotFound,
  sessionUsageRange,
  unknownModelNamesOf,
  unknownToNull,
  type RemoteSession
} from '../lib/sessions';
import { hasUsage, modelUsageItem } from '../lib/spend';
import type {
  AgentTrackingSessionDetail,
  AgentTrackingSessionModelUsage,
  AgentTrackingSessionView,
  SessionListOrderBy
} from '../lib/types';

class AgentTrackingSessionServiceImpl {
  listSessions(
    d: ReadScope & {
      memberIds?: string[];
      modelIds?: string[];
      clientFamilies?: string[];
      orderBy?: SessionListOrderBy;
      range?: RangeInput;
    }
  ) {
    let filters = {
      userIds: unknownToNull(d.memberIds),
      modelIds: unknownToNull(d.modelIds),
      clientFamilies: d.clientFamilies
        ? unique(d.clientFamilies.map(toServiceFamily))
        : undefined
    };
    let range = hasRange(d.range) ? normalizeRange(d.range) : undefined;
    let orderBy =
      d.orderBy && d.orderBy != 'last_activity' ? serviceOrderBy[d.orderBy] : undefined;

    return createRemotePaginator(async input => {
      let page = {
        limit: input.limit,
        order: input.order,
        ...(orderBy ? { orderBy } : {}),
        ...(input.after !== undefined ? { after: sessionAnchorOf(input.after) } : {}),
        ...(input.before !== undefined ? { before: sessionAnchorOf(input.before) } : {})
      };
      let now = new Date();

      await loadVisiblePrivacy(d);

      return await cachedRead({
        scope: d,
        read: 'sessions.list',
        input: { filters, page, ...(range ? { range: rangeCacheKey(range, now) } : {}) },
        ttlSeconds: sessionTtlSeconds,
        load: async instanceId => {
          let agentTracking = requireAgentTracking();
          let resolved = range ? resolveRange(range, now) : undefined;

          let result = await agentTracking.session.list(
            {
              organizationId: d.organization.id,
              instanceIds: [instanceId],
              ...filters,
              ...(resolved
                ? { lastActivityFrom: resolved.from, lastActivityTo: resolved.to }
                : {}),
              ...page
            },
            queryCallOptions
          );

          return {
            items: await this.describe({ scope: d, sessions: result.items }),
            hasMoreAfter: result.pagination.hasMoreAfter,
            hasMoreBefore: result.pagination.hasMoreBefore,
            after: result.pagination.after,
            before: result.pagination.before
          };
        }
      });
    });
  }

  async getSession(d: ReadScope & { sessionId: string }): Promise<AgentTrackingSessionDetail> {
    await loadVisiblePrivacy(d);

    if (!d.sessionId.startsWith(sessionIdPrefix)) throw sessionNotFound(d.sessionId);
    let sessionKey = d.sessionId.slice(sessionIdPrefix.length);

    return await cachedRead({
      scope: d,
      read: 'sessions.get',
      input: { sessionKey },
      ttlSeconds: sessionTtlSeconds,
      load: async instanceId => {
        let agentTracking = requireAgentTracking();

        let session = await agentTracking.session
          .get({ organizationId: d.organization.id, sessionKey }, queryCallOptions)
          .catch(error => {
            if (
              isServiceError(error) &&
              error.data.status == 404 &&
              error.data.entity == 'session'
            ) {
              throw sessionNotFound(d.sessionId);
            }
            throw error;
          });
        if (session.instanceId != instanceId) throw sessionNotFound(d.sessionId);

        let [[view], usageByModel] = await Promise.all([
          this.describe({ scope: d, sessions: [session] }),
          this.usageByModel({ scope: d, instanceId, session })
        ]);

        return { ...view!, usageByModel };
      }
    });
  }

  private async usageByModel(d: {
    scope: ReadScope;
    instanceId: string;
    session: RemoteSession;
  }): Promise<AgentTrackingSessionModelUsage[]> {
    let result = await runUsageQuery(
      d.scope,
      d.instanceId,
      sessionModelsQuery({
        sessionKey: d.session.sessionKey,
        range: sessionUsageRange(d.session)
      })
    );

    let labels = (result.labels.model ?? {}) as Record<string, { name?: string | null }>;
    let unknownModelNames = unknownModelNamesOf(d.session);

    return result.rows
      .filter(hasUsage)
      .map(row => modelUsageItem(row, labels, unknownModelNames));
  }

  private async describe(d: { scope: ReadScope; sessions: RemoteSession[] }) {
    let modelIdsOf = (session: RemoteSession) =>
      unique((session.summary?.models ?? []).map(model => model.modelId));

    let [members, modelNames] = await Promise.all([
      lookupMembers({
        scope: d.scope,
        ids: unique(d.sessions.map(session => session.observed.userId))
      }),
      lookupModelNames(d.sessions.flatMap(modelIdsOf))
    ]);

    return d.sessions.map((session): AgentTrackingSessionView => {
      let summary = session.summary;
      let userId = session.observed.userId;

      return {
        id: sessionIdOf(session.sessionKey),
        state: session.state,
        member: userId ? (members.get(userId) ?? null) : null,
        client: clientOf(session.client),
        models: modelIdsOf(session).map(id => ({ id, name: modelNames.get(id) ?? null })),
        unknownModelNames: unknownModelNamesOf(session),
        billingModes: unique((summary?.models ?? []).map(model => model.billing.mode)),
        cost: costOf({
          total: summary?.costUsd,
          listPrice: summary?.costComputedUsd,
          reported: summary?.costReported
        }),
        tokens: tokensOf(summary?.tokens),
        requests: countOf(summary?.requests),
        summaryPending: !summary || session.summaryStale,
        startedAt: new Date(session.startedAt),
        lastActivityAt: new Date(session.lastActivityAt),
        endedAt: session.endedAt ? new Date(session.endedAt) : null
      };
    });
  }
}

export let agentTrackingSessionService = Service.create(
  'agentTrackingSessionService',
  () => new AgentTrackingSessionServiceImpl()
).build();
