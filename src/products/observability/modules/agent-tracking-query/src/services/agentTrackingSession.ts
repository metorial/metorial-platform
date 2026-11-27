import { badRequestError, isServiceError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  toolCallClientSources,
  type ToolCallClientSource
} from '@metorial-subspace/module-connection';
import { toolCallService } from '@metorial-subspace/module-session';
import type { Instance, Organization, OrganizationActor, Project } from '@metorial/db';
import {
  assertAgentTrackingEnabled,
  requireAgentTracking,
  toServiceFamily
} from '@metorial/module-agent-tracking-sync';
import { sessionTtlSeconds } from '../lib/cache';
import { clientOf, lookupModelNames } from '../lib/catalog';
import { pullRequestUrl, repositoryHost, ticketsOf } from '../lib/urls';
import { chunks, lookupMembers, unique } from '../lib/members';
import { costOf, countOf, tokensOf } from '../lib/money';
import { normalizeTicketKey } from '../lib/filterValues';
import { loadVisibleSettings } from '../lib/privacy';
import { lookupProviders, providersOf, type ProviderReadScope } from '../lib/providers';
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
  AgentTrackingMetorialToolCall,
  AgentTrackingRepository,
  AgentTrackingSessionDetail,
  AgentTrackingSessionModelUsage,
  AgentTrackingSessionToolCalls,
  AgentTrackingSessionView,
  AgentTrackingToolCallSession,
  SessionListOrderBy
} from '../lib/types';

let maxSessionRepositories = 16;

let maxSessionProviders = 16;

export let maxToolCallSessionLookups = 100;

let maxClientCallLookups = 200;

let toolCallPageSize = 100;

let maxToolCallPages = 10;

let displaySettingsOf = (
  settings: Awaited<ReturnType<typeof loadVisibleSettings>>,
  scope: Pick<ProviderReadScope, 'canReadProviders'>
) => ({
  titles: settings.desktop.sessionTitles,
  ticketUrlTemplate: settings.links.ticketUrlTemplate,
  providerNames: !!scope.canReadProviders
});

type DisplaySettings = ReturnType<typeof displaySettingsOf>;

let repositoryIdsOf = (session: RemoteSession) =>
  (session.context?.repoIds ?? []).slice(0, maxSessionRepositories);

let providerIdsOf = (session: RemoteSession) =>
  (session.summary?.metorial?.providerIds ?? []).slice(0, maxSessionProviders);

type ToolCallScope = ProviderReadScope & {
  organization: Organization;
  project: Project;
  instance: Instance;
  organizationActor?: OrganizationActor;
  canReadToolCalls: boolean;
};

type ToolCallListParams = Omit<
  Parameters<typeof toolCallService.listToolCalls>[0],
  'instance' | 'organizationActor'
>;

type MetorialToolCallRow = Awaited<
  ReturnType<Awaited<ReturnType<typeof toolCallService.listToolCalls>>['run']>
>['items'][number];

type ClientCallRef = { clientFamily: string; toolCallId: string };

let clientCallKey = (call: ClientCallRef) => `${call.clientFamily}\u0000${call.toolCallId}`;

let isClientCallSource = (family: string): family is ToolCallClientSource =>
  (toolCallClientSources as readonly string[]).includes(family);

let clientCallOf = (row: MetorialToolCallRow): ClientCallRef | null =>
  row.clientCallId && row.clientCallSource
    ? { clientFamily: row.clientCallSource, toolCallId: row.clientCallId }
    : null;

let metorialToolCallOf = (row: MetorialToolCallRow): AgentTrackingMetorialToolCall => ({
  id: row.id,
  status: row.message.status,
  tool: { id: row.tool.id, key: row.tool.key, name: row.tool.name },
  provider: { id: row.tool.provider.id, name: row.tool.provider.name },
  sessionId: row.message.session.id,
  connectionId: row.message.connection?.id ?? null,
  messageId: row.message.id,
  createdAt: row.createdAt
});

class AgentTrackingSessionServiceImpl {
  listSessions(
    d: ReadScope &
      ProviderReadScope & {
        memberIds?: string[];
        modelIds?: string[];
        clientFamilies?: string[];
        repositoryIds?: string[];
        branches?: string[];
        tickets?: string[];
        pullRequests?: string[];
        providerIds?: string[];
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
      pullRequests: d.pullRequests ? unique(d.pullRequests) : undefined,
      metorialProviderIds: d.providerIds ? unique(d.providerIds) : undefined
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

      let display = displaySettingsOf(await loadVisibleSettings(d), d);

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

  async getSession(
    d: ReadScope & ProviderReadScope & { sessionId: string }
  ): Promise<AgentTrackingSessionDetail> {
    let display = displaySettingsOf(await loadVisibleSettings(d), d);

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

  async listSessionToolCalls(
    d: ToolCallScope & { sessionId: string }
  ): Promise<AgentTrackingSessionToolCalls> {
    await this.assertEnabled(d);
    await loadVisibleSettings(d);

    if (!d.sessionId.startsWith(sessionIdPrefix)) throw sessionNotFound(d.sessionId);
    let sessionKey = d.sessionId.slice(sessionIdPrefix.length);

    let agentCalls = await cachedRead({
      scope: d,
      read: 'sessions.mcpToolCalls',
      input: { sessionKey },
      ttlSeconds: sessionTtlSeconds,
      load: async () => {
        let result = await requireAgentTracking()
          .session.listMcpToolCalls(
            { organizationId: d.organization.id, sessionKey },
            queryCallOptions
          )
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
        if (result.instanceId != d.instance.id) throw sessionNotFound(d.sessionId);

        return { items: result.items, hasMore: result.hasMore };
      }
    });

    if (!d.canReadToolCalls) {
      return { sessionId: d.sessionId, items: [], unmatchedCount: null, hasMore: false };
    }

    let { rows, truncated } = await this.findByClientCalls({
      scope: d,
      calls: agentCalls.items
    });
    let rowsByCall = new Map<string, MetorialToolCallRow[]>();
    for (let row of rows) {
      let call = clientCallOf(row);
      if (!call) continue;

      let key = clientCallKey(call);
      rowsByCall.set(key, [...(rowsByCall.get(key) ?? []), row]);
    }

    let items = agentCalls.items.flatMap(call =>
      (rowsByCall.get(clientCallKey(call)) ?? []).map(row => ({
        occurredAt: new Date(call.occurredAt),
        durationMs: call.durationMs,
        outcome: call.outcome,
        toolCall: metorialToolCallOf(row)
      }))
    );
    let unmatched = agentCalls.items.filter(call => !rowsByCall.has(clientCallKey(call)));

    return {
      sessionId: d.sessionId,
      items,
      unmatchedCount: unmatched.length,
      hasMore: agentCalls.hasMore || truncated
    };
  }

  async listToolCallSessions(
    d: ToolCallScope & { toolCallIds: string[] }
  ): Promise<AgentTrackingToolCallSession[]> {
    await this.assertEnabled(d);
    let display = displaySettingsOf(await loadVisibleSettings(d), d);

    let toolCallIds = [...new Set(d.toolCallIds)];
    if (toolCallIds.length > maxToolCallSessionLookups) {
      throw new ServiceError(
        badRequestError({
          message: `At most ${maxToolCallSessionLookups} tool calls can be looked up at once.`
        })
      );
    }
    if (!toolCallIds.length || !d.canReadToolCalls) return [];

    let { rows } = await this.listAllToolCalls({ scope: d, params: { ids: toolCallIds } });
    let callsById = new Map(
      rows.flatMap(row => {
        let call = clientCallOf(row);
        return call ? [[row.id, call] as const] : [];
      })
    );
    if (!callsById.size) return [];

    let calls = [...new Map([...callsById.values()].map(call => [clientCallKey(call), call]))]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, call]) => call);

    let found = await cachedRead({
      scope: d,
      read: 'sessions.forToolCalls',
      input: { calls, display },
      ttlSeconds: sessionTtlSeconds,
      load: async () => {
        let result = await requireAgentTracking().session.findByToolCalls(
          {
            organizationId: d.organization.id,
            instanceId: d.instance.id,
            toolCalls: calls
          },
          queryCallOptions
        );

        let ambiguous = new Set(result.ambiguous.map(clientCallKey));
        let sessions = result.sessions.filter(session => session.instanceId == d.instance.id);
        let views = await this.describe({ scope: d, sessions, display });
        let viewsByKey = new Map(
          sessions.map((session, i) => [session.sessionKey, views[i]!])
        );

        return result.items.flatMap(item => {
          let session = viewsByKey.get(item.sessionKey);
          if (!session || ambiguous.has(clientCallKey(item))) return [];

          return [{ key: clientCallKey(item), session }];
        });
      }
    });
    let sessionsByCall = new Map(found.map(item => [item.key, item.session]));

    return toolCallIds.flatMap(toolCallId => {
      let call = callsById.get(toolCallId);
      let session = call ? sessionsByCall.get(clientCallKey(call)) : undefined;

      return session ? [{ toolCallId, session }] : [];
    });
  }

  private async assertEnabled(d: { organization: Organization; project: Project }) {
    await assertAgentTrackingEnabled({ organization: d.organization, project: d.project });
  }

  private async findByClientCalls(d: { scope: ToolCallScope; calls: ClientCallRef[] }) {
    let idsBySource = new Map<ToolCallClientSource, string[]>();
    for (let call of d.calls) {
      if (!isClientCallSource(call.clientFamily)) continue;
      idsBySource.set(call.clientFamily, [
        ...(idsBySource.get(call.clientFamily) ?? []),
        call.toolCallId
      ]);
    }

    let rows: MetorialToolCallRow[] = [];
    let truncated = false;
    for (let [clientCallSource, ids] of idsBySource) {
      for (let clientCallIds of chunks(unique(ids), maxClientCallLookups)) {
        let found = await this.listAllToolCalls({
          scope: d.scope,
          params: { clientCallIds, clientCallSource }
        });
        rows.push(...found.rows);
        truncated ||= found.truncated;
      }
    }

    return { rows, truncated };
  }

  private async listAllToolCalls(d: { scope: ToolCallScope; params: ToolCallListParams }) {
    let paginator = await toolCallService.listToolCalls({
      instance: d.scope.instance,
      organizationActor: d.scope.organizationActor,
      allowDeleted: false,
      omitBodies: true,
      ...d.params
    });

    let rows: MetorialToolCallRow[] = [];
    let after: string | undefined;
    for (let page = 0; page < maxToolCallPages; page++) {
      let list = await paginator.run({
        limit: toolCallPageSize,
        order: 'asc',
        ...(after ? { after } : {})
      });
      rows.push(...list.items);

      after = list.items.at(-1)?.id;
      if (!list.pagination.hasNextPage || !after) return { rows, truncated: false };
    }

    return { rows, truncated: true };
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
    scope: ReadScope & ProviderReadScope;
    sessions: RemoteSession[];
    display: DisplaySettings;
  }) {
    let modelIdsOf = (session: RemoteSession) =>
      unique((session.summary?.models ?? []).map(model => model.modelId));

    let [members, modelNames, repositories, providers] = await Promise.all([
      lookupMembers({
        scope: d.scope,
        ids: unique(d.sessions.map(session => session.observed.userId))
      }),
      lookupModelNames(d.sessions.flatMap(modelIdsOf)),
      lookupRepositories({
        scope: d.scope,
        ids: d.sessions.flatMap(repositoryIdsOf)
      }),
      lookupProviders({
        scope: { instance: d.scope.instance, canReadProviders: d.display.providerNames },
        ids: d.sessions.flatMap(providerIdsOf)
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
        providers: providersOf(providerIdsOf(session), providers),
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
