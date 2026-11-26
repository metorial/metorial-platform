import { isServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { requireAgentTracking, toServiceFamily } from '@metorial/module-agent-tracking-sync';
import { sessionTtlSeconds } from '../lib/cache';
import { clientOf, lookupModelNames } from '../lib/catalog';
import { pullRequestUrl, repositoryHost, ticketsOf } from '../lib/urls';
import { lookupMembers, unique } from '../lib/members';
import { costOf, countOf, tokensOf } from '../lib/money';
import { normalizeTicketKey } from '../lib/filterValues';
import { loadVisibleSettings } from '../lib/privacy';
import { sessionModelsQuery } from '../lib/queries';
import {
  hasRange,
  normalizeRange,
  rangeCacheKey,
  resolveRange,
  type RangeInput
} from '../lib/range';
import { createRemotePaginator } from '../lib/remotePaginator';
import { lookupRepositories } from '../lib/repositories';
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
  AgentTrackingCommit,
  AgentTrackingRepository,
  AgentTrackingSessionDetail,
  AgentTrackingSessionModelUsage,
  AgentTrackingSessionView,
  SessionListOrderBy
} from '../lib/types';

let maxSessionRepositories = 16;

let displaySettingsOf = (settings: Awaited<ReturnType<typeof loadVisibleSettings>>) => ({
  titles: settings.desktop.sessionTitles,
  ticketUrlTemplate: settings.links.ticketUrlTemplate
});

type DisplaySettings = ReturnType<typeof displaySettingsOf>;

let repositoryIdsOf = (session: RemoteSession) =>
  (session.context?.repoIds ?? []).slice(0, maxSessionRepositories);

class AgentTrackingSessionServiceImpl {
  listSessions(
    d: ReadScope & {
      memberIds?: string[];
      modelIds?: string[];
      clientFamilies?: string[];
      repositoryIds?: string[];
      branches?: string[];
      tickets?: string[];
      pullRequests?: string[];
      orderBy?: SessionListOrderBy;
      range?: RangeInput;
    }
  ) {
    let filters = {
      userIds: unknownToNull(d.memberIds),
      modelIds: unknownToNull(d.modelIds),
      clientFamilies: d.clientFamilies
        ? unique(d.clientFamilies.map(toServiceFamily))
        : undefined,
      repoIds: d.repositoryIds ? unique(d.repositoryIds) : undefined,
      branches: d.branches ? unique(d.branches) : undefined,
      ticketRefs: d.tickets ? unique(d.tickets.map(normalizeTicketKey)) : undefined,
      pullRequests: d.pullRequests ? unique(d.pullRequests) : undefined
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

      let display = displaySettingsOf(await loadVisibleSettings(d));

      return await cachedRead({
        scope: d,
        read: 'sessions.list',
        input: {
          filters,
          page,
          display,
          ...(range ? { range: rangeCacheKey(range, now) } : {})
        },
        ttlSeconds: sessionTtlSeconds,
        load: async () => {
          let agentTracking = requireAgentTracking();
          let resolved = range ? resolveRange(range, now) : undefined;

          let result = await agentTracking.session.list(
            {
              organizationId: d.organization.id,
              instanceIds: [d.instance.id],
              ...filters,
              ...(resolved
                ? { lastActivityFrom: resolved.from, lastActivityTo: resolved.to }
                : {}),
              ...page
            },
            queryCallOptions
          );

          return {
            items: await this.describe({ scope: d, sessions: result.items, display }),
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
    let display = displaySettingsOf(await loadVisibleSettings(d));

    if (!d.sessionId.startsWith(sessionIdPrefix)) throw sessionNotFound(d.sessionId);
    let sessionKey = d.sessionId.slice(sessionIdPrefix.length);

    return await cachedRead({
      scope: d,
      read: 'sessions.get',
      input: { sessionKey, display },
      ttlSeconds: sessionTtlSeconds,
      load: async () => {
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
        if (session.instanceId != d.instance.id) throw sessionNotFound(d.sessionId);

        let [[view], usageByModel] = await Promise.all([
          this.describe({ scope: d, sessions: [session], display }),
          this.usageByModel({ scope: d, session })
        ]);

        return {
          ...view!,
          usageByModel,
          commits: this.commitsOf({
            session,
            display,
            repositories: view!.context.repositories
          })
        };
      }
    });
  }

  private async usageByModel(d: {
    scope: ReadScope;
    session: RemoteSession;
  }): Promise<AgentTrackingSessionModelUsage[]> {
    let result = await runUsageQuery(
      d.scope,
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

  private commitsOf(d: {
    session: RemoteSession;
    display: DisplaySettings;
    repositories: AgentTrackingRepository[];
  }): AgentTrackingCommit[] {
    return (d.session.summary?.commitRefs ?? []).map(commit => ({
      sha: commit.sha,
      committedAt: new Date(commit.at),
      branch: commit.branch ?? null,
      tickets: ticketsOf(commit.ticketRefs ?? [], {
        template: d.display.ticketUrlTemplate,
        repositories: d.repositories
      }),
      aiAuthored: commit.aiAuthored ?? null
    }));
  }

  private contextOf(d: {
    session: RemoteSession;
    display: DisplaySettings;
    repositories: Map<string, AgentTrackingRepository>;
  }): AgentTrackingSessionView['context'] {
    let context = d.session.context;
    let summary = d.session.summary;
    let repositories = repositoryIdsOf(d.session).flatMap(id => {
      let repository = d.repositories.get(id);
      return repository ? [repository] : [];
    });

    return {
      repositories,
      branch: context?.branch ?? null,
      defaultBranch: context?.defaultBranch ?? null,
      head: context?.head ?? null,
      worktree: context?.worktree ?? null,
      subPath: context?.subPath ?? null,
      permissionMode: context?.permissionMode ?? null,
      title: d.display.titles ? (context?.title ?? null) : null,
      tickets: ticketsOf(context?.ticketRefs ?? [], {
        template: d.display.ticketUrlTemplate,
        repositories
      }),
      pullRequests: (summary?.pullRequestRefs ?? []).map(pullRequest => ({
        key: pullRequest.key,
        provider: pullRequest.provider,
        host: repositoryHost(pullRequest.provider),
        repository: pullRequest.repository,
        number: pullRequest.number,
        kind: pullRequest.kind,
        url: pullRequestUrl(pullRequest, repositories)
      })),
      commitCount: countOf(summary?.commits),
      pullRequestCount: countOf(summary?.pullRequests),
      lines: {
        added: countOf(summary?.lines?.added),
        removed: countOf(summary?.lines?.removed)
      }
    };
  }

  private async describe(d: {
    scope: ReadScope;
    sessions: RemoteSession[];
    display: DisplaySettings;
  }) {
    let modelIdsOf = (session: RemoteSession) =>
      unique((session.summary?.models ?? []).map(model => model.modelId));

    let [members, modelNames, repositories] = await Promise.all([
      lookupMembers({
        scope: d.scope,
        ids: unique(d.sessions.map(session => session.observed.userId))
      }),
      lookupModelNames(d.sessions.flatMap(modelIdsOf)),
      lookupRepositories({
        scope: d.scope,
        ids: d.sessions.flatMap(repositoryIdsOf)
      })
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
        context: this.contextOf({ session, display: d.display, repositories }),
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
