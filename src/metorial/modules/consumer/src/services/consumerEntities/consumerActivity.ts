import { notFoundError, ServiceError } from '@lowerdeck/error';
import { PaginatorInputStrict } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { ConsumerProfile, Instance } from '@metorial/db';
import { AnyAccessTagSelector } from '@metorial/module-access';
import { magicMcpEndpointService } from '@metorial/module-magic';
import {
  subspaceAgentService,
  subspaceIdentityCredentialService,
  subspaceSessionConnectionService,
  subspaceToolCallService
} from '@metorial/module-subspace';
import { consumerActivityScopeService } from './consumerActivityScope';

type ActivityInput = {
  instance: Instance;
  consumerProfile: ConsumerProfile;
  accessTags: AnyAccessTagSelector;
};

type SessionConnectionListInput = Parameters<typeof subspaceSessionConnectionService.list>[0];
type ToolCallListInput = Parameters<typeof subspaceToolCallService.list>[0];
type IdentityCredentialListInput = Parameters<
  typeof subspaceIdentityCredentialService.list
>[0];

let getConnectionAgentId = (
  connection: Awaited<ReturnType<typeof subspaceSessionConnectionService.get>>
) => connection.participant?.agentId;

class ConsumerActivityServiceImpl {
  private async resolve(d: ActivityInput) {
    return await consumerActivityScopeService.resolve(d);
  }

  private async getObservedConnections(d: ActivityInput) {
    let scope = await this.resolve(d);
    let paginator = await subspaceSessionConnectionService.list({
      instance: d.instance,
      allowDeleted: false,
      sessionIds: scope.subspaceSessionIds,
      accessTagSessionIds: scope.subspaceSessionIds
    });
    let connections: Awaited<ReturnType<typeof paginator.run>>['items'] = [];
    let after: string | undefined;

    while (true) {
      let list = await paginator.run({
        limit: 100,
        after
      });
      connections.push(...list.items);

      if (!list.pagination.hasNextPage || list.items.length === 0) break;
      after = list.items[list.items.length - 1]!.id;
    }

    return {
      scope,
      connections
    };
  }

  private getObservedAgentIds(
    connections: Awaited<ReturnType<typeof this.getObservedConnections>>['connections']
  ) {
    return Array.from(
      new Set(
        connections.map(getConnectionAgentId).filter((agentId): agentId is string => !!agentId)
      )
    );
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
    let observed = await this.getObservedConnections(d);
    let observedAgentIds = this.getObservedAgentIds(observed.connections);
    let paginator = await subspaceAgentService.list({
      instance: d.instance,
      allowDeleted: false,
      ids: observedAgentIds,
      types: ['mcp_client'],
      search: d.search
    });
    let list = await paginator.run(d.pagination);

    return {
      ...list,
      items: await Promise.all(
        list.items.map(async agent => {
          let sessionIds = observed.connections
            .filter(connection => getConnectionAgentId(connection) === agent.id)
            .map(connection => connection.sessionId);

          return {
            agent,
            magicMcpEndpoints: await this.getEndpointsForSessions(
              d,
              observed.scope,
              sessionIds
            )
          };
        })
      )
    };
  }

  async getAgent(d: ActivityInput & { agentId: string }) {
    let observed = await this.getObservedConnections(d);
    if (!this.getObservedAgentIds(observed.connections).includes(d.agentId)) {
      throw new ServiceError(notFoundError('agent'));
    }

    let agent = await subspaceAgentService.get({
      instance: d.instance,
      agentId: d.agentId,
      allowDeleted: false
    });
    if (agent.type !== 'mcp_client') {
      throw new ServiceError(notFoundError('agent'));
    }

    let sessionIds = observed.connections
      .filter(connection => getConnectionAgentId(connection) === agent.id)
      .map(connection => connection.sessionId);

    return {
      agent,
      magicMcpEndpoints: await this.getEndpointsForSessions(d, observed.scope, sessionIds)
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
    let observed = await this.getObservedConnections(d);
    if (d.agentId && !this.getObservedAgentIds(observed.connections).includes(d.agentId)) {
      throw new ServiceError(notFoundError('agent'));
    }
    if (d.sessionId && !observed.scope.subspaceSessionIds.includes(d.sessionId)) {
      throw new ServiceError(notFoundError('session'));
    }

    let paginator = await subspaceSessionConnectionService.list({
      instance: d.instance,
      allowDeleted: false,
      accessTagSessionIds: observed.scope.subspaceSessionIds,
      sessionIds: d.sessionId ? [d.sessionId] : observed.scope.subspaceSessionIds,
      agentIds: d.agentId ? [d.agentId] : undefined,
      connectionState: d.connectionState,
      createdAt: d.createdAt
    });
    let list = await paginator.run(d.pagination);
    let magicSessionBySubspaceSessionId = new Map(
      observed.scope.magicMcpSessions.map(session => [session.subspaceSessionId, session])
    );

    return {
      ...list,
      items: list.items.map(sessionConnection => ({
        sessionConnection,
        magicMcpSession:
          magicSessionBySubspaceSessionId.get(sessionConnection.sessionId) ?? null
      }))
    };
  }

  async getSessionConnection(d: ActivityInput & { sessionConnectionId: string }) {
    let scope = await this.resolve(d);
    let sessionConnection = await subspaceSessionConnectionService.get({
      instance: d.instance,
      sessionConnectionId: d.sessionConnectionId
    });
    if (!scope.subspaceSessionIds.includes(sessionConnection.sessionId)) {
      throw new ServiceError(notFoundError('session.connection'));
    }

    return {
      sessionConnection,
      magicMcpSession:
        scope.magicMcpSessions.find(
          session => session.subspaceSessionId === sessionConnection.sessionId
        ) ?? null
    };
  }

  async listToolCalls(
    d: ActivityInput & {
      pagination: PaginatorInputStrict;
      agentId?: string;
      toolId?: string;
      createdAt?: ToolCallListInput['createdAt'];
    }
  ) {
    let observed = await this.getObservedConnections(d);
    if (d.agentId && !this.getObservedAgentIds(observed.connections).includes(d.agentId)) {
      throw new ServiceError(notFoundError('agent'));
    }

    let paginator = await subspaceToolCallService.list({
      instance: d.instance,
      allowDeleted: false,
      actorIds: [observed.scope.consumerActor.id],
      agentIds: d.agentId ? [d.agentId] : undefined,
      toolIds: d.toolId ? [d.toolId] : undefined,
      createdAt: d.createdAt
    });

    return await paginator.run(d.pagination);
  }

  async getToolCall(d: ActivityInput & { toolCallId: string }) {
    let scope = await this.resolve(d);
    let paginator = await subspaceToolCallService.list({
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
    let paginator = await subspaceIdentityCredentialService.list({
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
    let paginator = await subspaceIdentityCredentialService.list({
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
