import { notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type Session,
  type SessionMessageStatus,
  type Tenant,
  type ToolCall,
  type ToolCallAttachment
} from '@metorial-subspace/db';
import {
  checkDeletedRelation,
  type DateFilter,
  mergeRetentionWithDateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveAgents,
  resolveIdentities,
  resolveIdentityActors,
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders,
  resolveProviderTools,
  resolveSessionTemplates
} from '@metorial-subspace/list-utils';
import { agentInstanceService, agentService } from '@metorial-subspace/module-agent';
import { SenderManager } from '@metorial-subspace/module-connection';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import { env } from '../env';
import { enrichSessionParticipantsWithConsumer } from '../lib/enrichSessionParticipants';
import { sessionMessageInclude, sessionMessageService } from './sessionMessage';

let include = {
  attachments: true,
  tool: {
    include: {
      provider: true,
      specification: true
    }
  }
};

let connectionInitLock = createLock({
  name: 'sub/ses/toc/init/lock',
  redisUrl: env.service.REDIS_URL
});

export type ListToolCallsParams = {
  status?: SessionMessageStatus[];
  allowDeleted?: boolean;

  ids?: string[];
  agentIds?: string[];
  actorIds?: string[];
  identityIds?: string[];
  agentInstanceIds?: string[];
  sessionTemplateIds?: string[];
  sessionProviderIds?: string[];
  providerIds?: string[];
  providerDeploymentIds?: string[];
  providerConfigIds?: string[];
  providerAuthConfigIds?: string[];
  toolIds?: string[];
  connectionIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetToolCallByIdParams = {
  toolCallId: string;
  allowDeleted?: boolean;
};

export type CreateToolCallParams = {
  session: Session;
  input: {
    metadata?: Record<string, any>;
    toolId: string;
    input: Record<string, any>;
    agentId?: string;
    rationale?: string;
    operation?: string;
  };
};

class toolCallServiceImpl {
  async enrichToolCalls<T extends ToolCall & { attachments?: ToolCallAttachment[] }>(
    toolCalls: T[]
  ) {
    let messageOids = toolCalls.map(tc => tc.messageOid).filter(Boolean);
    let messages = await sessionMessageService.enrichMessages(
      await db.sessionMessage.findMany({
        where: { oid: { in: messageOids } },
        include: sessionMessageInclude
      })
    );
    let messageMap = new Map(messages.map(m => [m.oid, m]));

    return toolCalls.map(tc => ({
      ...tc,
      message: messageMap.get(tc.messageOid)!
    }));
  }

  async listToolCalls(d: MetorialFacing<ListToolCallsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let paginator = await this.listToolCallsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    return paginator.mapAll(async items => {
      let participants = await enrichSessionParticipantsWithConsumer({
        instanceOid: instance.oid,
        participants: items.flatMap(item =>
          [item.message.senderParticipant, item.message.responderParticipant].filter(
            (participant): participant is NonNullable<typeof participant> => !!participant
          )
        )
      });
      let participantMap = new Map(
        participants.map(participant => [participant.id, participant])
      );

      return items.map(item => ({
        ...item,
        senderParticipant:
          participantMap.get(item.message.senderParticipant.id) ??
          item.message.senderParticipant,
        responderParticipant: item.message.responderParticipant
          ? (participantMap.get(item.message.responderParticipant.id) ??
            item.message.responderParticipant)
          : null
      }));
    });
  }

  async listToolCallsInternal(d: { tenant: Tenant; environment: Environment } & ListToolCallsParams) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let agents = await resolveAgents(ts, d.agentIds);
    let actors = await resolveIdentityActors(ts, d.actorIds);
    let identities = await resolveIdentities(ts, d.identityIds);
    let sessionTemplates = await resolveSessionTemplates(ts, d.sessionTemplateIds);
    let sessionProviders = await resolveProviders(ts, d.sessionProviderIds);
    let providers = await resolveProviders(ts, d.providerIds);
    let deployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(ts, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(ts, d.providerAuthConfigIds);
    let tools = await resolveProviderTools(d.toolIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let res = await db.toolCall.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,

            message: normalizeStatusForList(d).onlyParent,

            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              d.agentInstanceIds
                ? {
                    message: {
                      OR: [
                        {
                          senderParticipant: {
                            agentInstance: { id: { in: d.agentInstanceIds } }
                          }
                        },
                        {
                          responderParticipant: {
                            agentInstance: { id: { in: d.agentInstanceIds } }
                          }
                        }
                      ]
                    }
                  }
                : undefined!,
              agents
                ? {
                    message: {
                      OR: [
                        {
                          senderParticipant: {
                            agentInstance: { agentOid: agents.in }
                          }
                        },
                        {
                          responderParticipant: {
                            agentInstance: { agentOid: agents.in }
                          }
                        }
                      ]
                    }
                  }
                : undefined!,
              actors
                ? {
                    session: { identityActorOid: actors.in }
                  }
                : undefined!,
              identities
                ? {
                    message: {
                      OR: [
                        {
                          senderParticipant: {
                            identityOid: identities.in
                          }
                        },
                        {
                          responderParticipant: {
                            identityOid: identities.in
                          }
                        }
                      ]
                    }
                  }
                : undefined!,

              tools
                ? {
                    OR: [{ tool: { oid: tools.in } }, { toolKey: { in: d.toolIds ?? [] } }]
                  }
                : undefined!,

              d.connectionIds
                ? {
                    message: {
                      connection: { id: { in: d.connectionIds } }
                    }
                  }
                : undefined!,

              sessionTemplates
                ? {
                    session: {
                      providers: { some: { fromTemplateOid: sessionTemplates.in } }
                    }
                  }
                : undefined!,

              sessionProviders
                ? { session: { providers: { some: { oid: sessionProviders.in } } } }
                : undefined!,

              providers
                ? { session: { providers: { some: { providerOid: providers.in } } } }
                : undefined!,

              deployments
                ? { session: { providers: { some: { deploymentOid: deployments.in } } } }
                : undefined!,

              configs
                ? { session: { providers: { some: { configOid: configs.in } } } }
                : undefined!,

              authConfigs
                ? { session: { providers: { some: { authConfigOid: authConfigs.in } } } }
                : undefined!,

              mergeRetentionWithDateFilter(d.tenant, d.createdAt),
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean)
          },
          include
        });

        return await this.enrichToolCalls(res);
      })
    );
  }

  async getToolCallById(d: MetorialFacing<GetToolCallByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let toolCall = await this.getToolCallByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    let participants = await enrichSessionParticipantsWithConsumer({
      instanceOid: instance.oid,
      participants: [
        toolCall.message.senderParticipant,
        toolCall.message.responderParticipant
      ].filter((participant): participant is NonNullable<typeof participant> => !!participant)
    });
    let participantMap = new Map(participants.map(participant => [participant.id, participant]));

    return {
      ...toolCall,
      senderParticipant:
        participantMap.get(toolCall.message.senderParticipant.id) ??
        toolCall.message.senderParticipant,
      responderParticipant: toolCall.message.responderParticipant
        ? (participantMap.get(toolCall.message.responderParticipant.id) ??
          toolCall.message.responderParticipant)
        : null
    };
  }

  async getToolCallByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetToolCallByIdParams
  ) {
    let solution = await getMetorialSolution();

    let toolCall = await db.toolCall.findFirst({
      where: {
        id: d.toolCallId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,

        message: normalizeStatusForGet(d).onlyParent,
        ...mergeRetentionWithDateFilter(d.tenant)
      },
      include
    });
    if (!toolCall) throw new ServiceError(notFoundError('tool_call', d.toolCallId));

    let [enriched] = await this.enrichToolCalls([toolCall]);
    return enriched!;
  }

  async createToolCall(d: MetorialFacing<CreateToolCallParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.tool_call.created:before', eventBase);

    let toolCall = await this.createToolCallInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.tool_call.created:after', { ...eventBase, toolCall });

    return toolCall;
  }

  async createToolCallInternal(
    d: { tenant: Tenant; environment: Environment } & CreateToolCallParams
  ) {
    let solution = await getMetorialSolution();

    checkDeletedRelation(d.session);

    let agent = d.input.agentId
      ? await agentService.getAgentByIdInternal({
          agentId: d.input.agentId,
          tenant: d.tenant,
          environment: d.environment
        })
      : await agentService.upsertAgentInternal({
          tenant: d.tenant,
          environment: d.environment,
          input: {
            name: 'Manual Tool Calls',
            type: 'tool_call'
          }
        });

    let agentInstance = await agentInstanceService.upsertAgentInstanceInternal({
      tenant: d.tenant,
      environment: d.environment,
      agent,
      input: {
        name: agent.name,
        version: undefined,
        description: undefined,
        type: 'tool_call'
      }
    });

    let manager = await SenderManager.create({
      sessionId: d.session.id,
      solutionId: solution.id,
      tenantId: d.tenant.id,
      transport: 'tool_call'
    });

    let connection = await db.sessionConnection.findFirst({
      where: {
        state: 'connected',
        sessionOid: d.session.oid,
        isForManualToolCalls: true,
        participant: {
          agentInstanceOid: agentInstance.oid
        }
      }
    });

    if (!connection) {
      connection = await connectionInitLock.usingLock(d.session.id, async () => {
        let existing = await db.sessionConnection.findFirst({
          where: {
            state: 'connected',
            sessionOid: d.session.oid,
            isForManualToolCalls: true,
            participant: {
              agentInstanceOid: agentInstance.oid
            }
          }
        });
        if (existing) return existing;

        let connection = await manager.initialize({
          client: {
            name: agent.name,
            identifier: `metorial#tool_call:${agentInstance.id}`
          },
          mcpTransport: 'none',
          isManualConnection: true,
          agentInstance
        });

        return connection;
      });
    }

    await manager.setConnection(connection);

    let toolRes = await manager.callTool({
      toolId: d.input.toolId,
      input: {
        type: 'tool.call',
        data: d.input.input
      },
      rationale: d.input.rationale,
      operation: d.input.operation,
      waitForResponse: true,
      transport: 'tool_call'
    });

    let [toolCall] = await db.toolCall.updateManyAndReturn({
      where: { messageOid: toolRes.message.oid },
      data: { metadata: d.input.metadata },
      include
    });
    if (!toolCall) throw new Error('WTF - no message for tool call response');

    let [enriched] = await this.enrichToolCalls([toolCall]);
    return enriched!;
  }
}

export let toolCallService = Service.create(
  'session',
  () => new toolCallServiceImpl()
).build();
