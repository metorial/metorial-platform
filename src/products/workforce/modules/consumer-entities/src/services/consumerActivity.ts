import { notFoundError, ServiceError } from '@lowerdeck/error';
import type { PaginatorInputStrict } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { ConsumerProfile, Instance } from '@metorial/db';
import type { AnyAccessTagSelector } from '@metorial/module-access';
import { magicMcpEndpointService } from '@metorial/module-magic';
import { agentService } from '@metorial-subspace/module-agent';
import { identityCredentialService } from '@metorial-subspace/module-identity';
import { sessionConnectionService, toolCallService } from '@metorial-subspace/module-session';
import { consumerActivityScopeService } from './consumerActivityScope';

type ActivityInput = {
  instance: Instance;
  consumerProfile: ConsumerProfile;
  accessTags: AnyAccessTagSelector;
};

type SessionConnectionListInput = Parameters<
  typeof sessionConnectionService.listSessionConnections
>[0];
type ToolCallListInput = Parameters<typeof toolCallService.listToolCalls>[0];
type IdentityCredentialListInput = Parameters<
  typeof identityCredentialService.listIdentityCredentials
>[0];

class ConsumerActivityServiceImpl {
  private async resolve(d: ActivityInput) {
    return await consumerActivityScopeService.resolve(d);
  }

  private async getSessionIdsByAgent(
    d: ActivityInput,
    scope: Awaited<ReturnType<typeof consumerActivityScopeService.resolve>>,
    agentIds: string[]
  ) {
    let sessionIdsByAgent = new Map<string, Set<string>>();
    if (agentIds.length === 0) return sessionIdsByAgent;

    let paginator = await sessionConnectionService.listSessionConnections({
      instance: d.instance,
      allowDeleted: false,
      actorIds: [scope.consumerActor.id],
      agentIds
    });
    let after: string | undefined;

    while (true) {
      let list = await paginator.run({
        limit: 100,
        after
      });
      for (let connection of list.items) {
        let agentId = connection.participant?.agentInstance?.agent.id;
        if (!agentId) continue;

        let sessionIds = sessionIdsByAgent.get(agentId) ?? new Set<string>();
        sessionIds.add(connection.session.id);
        sessionIdsByAgent.set(agentId, sessionIds);
      }

      if (!list.pagination.hasNextPage || list.items.length === 0) break;
      after = list.items[list.items.length - 1]!.id;
    }

    return sessionIdsByAgent;
  }

  private async getScopedAgent(
    d: ActivityInput,
    scope: Awaited<ReturnType<typeof consumerActivityScopeService.resolve>>,
    agentId: string
  ) {
    let paginator = await agentService.listAgents({
      instance: d.instance,
      allowDeleted: false,
      ids: [agentId],
      actorIds: [scope.consumerActor.id],
      types: ['mcp_client']
    });
    let list = await paginator.run({ limit: 1 });
    let agent = list.items[0];
    if (!agent) throw new ServiceError(notFoundError('agent'));

    return agent;
  }

  private async ensureScopedSession(
    d: ActivityInput,
    scope: Awaited<ReturnType<typeof consumerActivityScopeService.resolve>>,
    sessionId: string
  ) {
    let paginator = await sessionConnectionService.listSessionConnections({
      instance: d.instance,
      allowDeleted: false,
      actorIds: [scope.consumerActor.id],
      sessionIds: [sessionId]
    });
    let list = await paginator.run({ limit: 1 });
    if (!list.items[0]) throw new ServiceError(notFoundError('session'));
  }

  private async getScopedConnection(
    d: ActivityInput,
    scope: Awaited<ReturnType<typeof consumerActivityScopeService.resolve>>,
    sessionConnectionId: string
  ) {
    let paginator = await sessionConnectionService.listSessionConnections({
      instance: d.instance,
      allowDeleted: false,
      ids: [sessionConnectionId],
      actorIds: [scope.consumerActor.id]
    });
    let list = await paginator.run({ limit: 1 });
    let sessionConnection = list.items[0];
    if (!sessionConnection) {
      throw new ServiceError(notFoundError('session.connection'));
    }

    return sessionConnection;
  }

  private async getEndpointsForSessions(
    d: ActivityInput,
    scope: Awaited<ReturnType<typeof consumerActivityScopeService.resolve>>,
    sessionIds: string[]
  ) {
    let sessionIdSet = new Set(sessionIds);
    let endpointIds = Array.from(
      new Set(
        scope.magicMcpSessions
          .filter(session => sessionIdSet.has(session.subspaceSessionId))
          .map(session => session.magicMcpEndpoint)
          .filter(
            (
              endpoint
            ): endpoint is NonNullable<
              (typeof scope.magicMcpSessions)[number]['magicMcpEndpoint']
            > => !!endpoint && endpoint.consumerProfileOid === d.consumerProfile.oid
          )
          .map(endpoint => endpoint.id)
      )
    );

    return await Promise.all(
      endpointIds.map(magicMcpEndpointId =>
        magicMcpEndpointService.getMagicMcpEndpointById({
          instance: d.instance,
          magicMcpEndpointId,
          accessTags: d.accessTags
        })
      )
    );
  }

  async listAgents(
    d: ActivityInput & {
      pagination: PaginatorInputStrict;
      search?: string;
    }
  ) {
    let scope = await this.resolve(d);
    let paginator = await agentService.listAgents({
      instance: d.instance,
      allowDeleted: false,
      actorIds: [scope.consumerActor.id],
      types: ['mcp_client'],
      search: d.search
    });
    let list = await paginator.run(d.pagination);
    let sessionIdsByAgent = await this.getSessionIdsByAgent(
      d,
      scope,
      list.items.map(agent => agent.id)
    );

    return {
      ...list,
      items: await Promise.all(
        list.items.map(async agent => {
          return {
            agent,
            magicMcpEndpoints: await this.getEndpointsForSessions(
              d,
              scope,
              Array.from(sessionIdsByAgent.get(agent.id) ?? [])
            )
          };
        })
      )
    };
  }

  async getAgent(d: ActivityInput & { agentId: string }) {
    let scope = await this.resolve(d);
    let agent = await this.getScopedAgent(d, scope, d.agentId);
    let sessionIdsByAgent = await this.getSessionIdsByAgent(d, scope, [agent.id]);

    return {
      agent,
      magicMcpEndpoints: await this.getEndpointsForSessions(
        d,
        scope,
        Array.from(sessionIdsByAgent.get(agent.id) ?? [])
      )
    };
  }

  async listSessionConnections(
    d: ActivityInput & {
      pagination: PaginatorInputStrict;
      connectionState?: SessionConnectionListInput['connectionState'];
      agentId?: string;
      sessionId?: string;
      createdAt?: SessionConnectionListInput['createdAt'];
    }
  ) {
    let scope = await this.resolve(d);
    if (d.agentId) await this.getScopedAgent(d, scope, d.agentId);
    if (d.sessionId) await this.ensureScopedSession(d, scope, d.sessionId);

    let paginator = await sessionConnectionService.listSessionConnections({
      instance: d.instance,
      allowDeleted: false,
      actorIds: [scope.consumerActor.id],
      sessionIds: d.sessionId ? [d.sessionId] : undefined,
      agentIds: d.agentId ? [d.agentId] : undefined,
      connectionState: d.connectionState,
      createdAt: d.createdAt
    });
    let list = await paginator.run(d.pagination);
    let magicSessionBySubspaceSessionId = new Map(
      scope.magicMcpSessions.map(session => [session.subspaceSessionId, session])
    );

    return {
      ...list,
      items: list.items.map(sessionConnection => ({
        sessionConnection,
        magicMcpSession:
          magicSessionBySubspaceSessionId.get(sessionConnection.session.id) ?? null
      }))
    };
  }

  async getSessionConnection(d: ActivityInput & { sessionConnectionId: string }) {
    let scope = await this.resolve(d);
    let sessionConnection = await this.getScopedConnection(d, scope, d.sessionConnectionId);

    return {
      sessionConnection,
      magicMcpSession:
        scope.magicMcpSessions.find(
          session => session.subspaceSessionId === sessionConnection.session.id
        ) ?? null
    };
  }

  async listToolCalls(
    d: ActivityInput & {
      pagination: PaginatorInputStrict;
      agentId?: string;
      toolId?: string;
      providerIds?: string[];
      sessionConnectionId?: string;
      createdAt?: ToolCallListInput['createdAt'];
    }
  ) {
    let scope = await this.resolve(d);
    if (d.agentId) await this.getScopedAgent(d, scope, d.agentId);
    if (d.sessionConnectionId) {
      await this.getScopedConnection(d, scope, d.sessionConnectionId);
    }

    let toolCallQuery: ToolCallListInput & { connectionIds?: string[] } = {
      instance: d.instance,
      allowDeleted: false,
      actorIds: [scope.consumerActor.id],
      agentIds: d.agentId ? [d.agentId] : undefined,
      toolIds: d.toolId ? [d.toolId] : undefined,
      providerIds: d.providerIds,
      connectionIds: d.sessionConnectionId ? [d.sessionConnectionId] : undefined,
      createdAt: d.createdAt
    };
    let paginator = await toolCallService.listToolCalls(toolCallQuery);

    return await paginator.run(d.pagination);
  }

  async getToolCall(d: ActivityInput & { toolCallId: string }) {
    let scope = await this.resolve(d);
    let paginator = await toolCallService.listToolCalls({
      instance: d.instance,
      allowDeleted: false,
      ids: [d.toolCallId],
      actorIds: [scope.consumerActor.id]
    });
    let list = await paginator.run({ limit: 1 });
    let toolCall = list.items[0];
    if (!toolCall) throw new ServiceError(notFoundError('tool_call'));

    return toolCall;
  }

  async listIdentityCredentials(
    d: ActivityInput & {
      pagination: PaginatorInputStrict;
      providerId?: string;
      status?: IdentityCredentialListInput['status'];
    }
  ) {
    let scope = await this.resolve(d);
    let paginator = await identityCredentialService.listIdentityCredentials({
      instance: d.instance,
      allowDeleted: false,
      actorIds: [scope.consumerActor.id],
      providerIds: d.providerId ? [d.providerId] : undefined,
      status: d.status
    });

    return await paginator.run(d.pagination);
  }

  async getIdentityCredential(d: ActivityInput & { identityCredentialId: string }) {
    let scope = await this.resolve(d);
    let paginator = await identityCredentialService.listIdentityCredentials({
      instance: d.instance,
      allowDeleted: false,
      ids: [d.identityCredentialId],
      actorIds: [scope.consumerActor.id]
    });
    let list = await paginator.run({ limit: 1 });
    let identityCredential = list.items[0];
    if (!identityCredential) {
      throw new ServiceError(notFoundError('identity.credential'));
    }

    return identityCredential;
  }
}

export let consumerActivityService = Service.create(
  'consumerActivityService',
  () => new ConsumerActivityServiceImpl()
).build();

export type ConsumerActivityAgent = Awaited<
  ReturnType<typeof consumerActivityService.getAgent>
>;
export type ConsumerActivitySessionConnection = Awaited<
  ReturnType<typeof consumerActivityService.getSessionConnection>
>;
