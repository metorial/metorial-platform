import { notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  GET_PAYLOAD_LIMIT_BYTES,
  LIST_PAYLOAD_LIMIT_BYTES
} from '@metorial-subspace/connection-utils';
import {
  db,
  type Environment,
  type Prisma,
  type Session,
  type SessionMessageStatus,
  type Solution,
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
  resolveSessions,
  resolveSessionTemplates
} from '@metorial-subspace/list-utils';
import { agentInstanceService, agentService } from '@metorial-subspace/module-agent';
import { getProviderTenantFilter } from '@metorial-subspace/module-catalog';
import { searchRelatedEntities, whenRelatedMatched } from '@metorial-subspace/module-search';
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
import {
  sessionMessageBodyOmit,
  sessionMessageInclude,
  sessionMessageService
} from './sessionMessage';
import {
  assertSessionVisible,
  getSessionVisibilityWhere,
  type SessionVisibilityWhere
} from '../lib/sessionVisibility';

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
  statuses?: SessionMessageStatus[];
  allowDeleted?: boolean;
  includeInternal?: boolean;

  ids?: string[];
  sessionIds?: string[];
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

  search?: string;
  searchActorIds?: string[];
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

export type CreateInternalToolCallParams = CreateToolCallParams & {
  adapter?: { identifier: string };
};

class toolCallServiceImpl {
  async enrichToolCalls<T extends ToolCall & { attachments?: ToolCallAttachment[] }>(
    toolCalls: T[],
    opts: { bodyLimitBytes: number }
  ) {
    let messageOids = toolCalls.map(tc => tc.messageOid).filter(Boolean);
    let messages = await sessionMessageService.enrichMessages(
      await db.sessionMessage.findMany({
        where: { oid: { in: messageOids } },
        include: sessionMessageInclude,
        omit: sessionMessageBodyOmit
      }),
      opts
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
      environment: scope.environment,
      sessionVisibility: await getSessionVisibilityWhere({
        tenant: scope.tenant,
        organizationActor
      })
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

  async listToolCallsInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
      sessionVisibility?: SessionVisibilityWhere;
    } & ListToolCallsParams
  ) {
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
    let sessions = await resolveSessions(ts, d.sessionIds);

    let searchFilter = await this.buildToolCallSearchFilter({ ...d, solution });

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
              d.sessionVisibility ? { session: d.sessionVisibility } : undefined!,
              !d.includeInternal && !d.sessionIds?.length
                ? { session: { isInternal: false } }
                : undefined!,
              d.ids ? { id: { in: d.ids } } : undefined!,
              d.statuses?.length ? { message: { status: { in: d.statuses } } } : undefined!,
              sessions ? { sessionOid: sessions.in } : undefined!,
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

              searchFilter!,

              mergeRetentionWithDateFilter(d.tenant, d.createdAt),
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean)
          },
          include
        });

        return await this.enrichToolCalls(res, { bodyLimitBytes: LIST_PAYLOAD_LIMIT_BYTES });
      })
    );
  }

  private async buildToolCallSearchFilter(d: {
    tenant: Tenant;
    environment: Environment;
    solution: Solution;
    search?: string;
    searchActorIds?: string[];
  }): Promise<Prisma.ToolCallWhereInput | undefined> {
    let search = d.search?.trim();
    if (!search) return undefined;

    let ts = { tenant: d.tenant, environment: d.environment, solution: d.solution };

    let [related, searchActors] = await Promise.all([
      searchRelatedEntities({
        tenant: d.tenant,
        query: search,
        kinds: [
          'toolGlobalOids',
          'providerOids',
          'deploymentOids',
          'configOids',
          'authConfigOids',
          'agentOids',
          'actorOids',
          'identityOids'
        ],
        providerFilter: getProviderTenantFilter({ ...ts, includeDeprecated: true })
      }),
      resolveIdentityActors(ts, d.searchActorIds?.length ? d.searchActorIds : undefined)
    ]);

    let actorOids = [...related.actorOids, ...(searchActors?.oids ?? [])];

    let sessionProviderClauses: Prisma.SessionProviderWhereInput[] = [
      ...whenRelatedMatched(related.providerOids, oids => ({ providerOid: oids })),
      ...whenRelatedMatched(related.deploymentOids, oids => ({ deploymentOid: oids })),
      ...whenRelatedMatched(related.configOids, oids => ({ configOid: oids })),
      ...whenRelatedMatched(related.authConfigOids, oids => ({ authConfigOid: oids }))
    ];

    return {
      OR: [
        { id: search },
        { toolKey: search },
        ...whenRelatedMatched(related.toolGlobalOids, oids => ({ tool: { globalOid: oids } })),
        ...(sessionProviderClauses.length
          ? [{ session: { providers: { some: { OR: sessionProviderClauses } } } }]
          : []),
        ...whenRelatedMatched(related.agentOids, oids => ({
          message: {
            OR: [
              { senderParticipant: { agentInstance: { agentOid: oids } } },
              { responderParticipant: { agentInstance: { agentOid: oids } } }
            ]
          }
        })),
        ...whenRelatedMatched(related.identityOids, oids => ({
          message: {
            OR: [
              { senderParticipant: { identityOid: oids } },
              { responderParticipant: { identityOid: oids } }
            ]
          }
        })),
        ...whenRelatedMatched(actorOids, oids => ({ session: { identityActorOid: oids } }))
      ]
    };
  }

  async getToolCallById(d: MetorialFacing<GetToolCallByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let toolCall = await this.getToolCallByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await assertSessionVisible({
      tenant: scope.tenant,
      organizationActor,
      sessionOid: toolCall.sessionOid,
      resource: 'tool_call',
      id: d.toolCallId
    });

    let participants = await enrichSessionParticipantsWithConsumer({
      instanceOid: instance.oid,
      participants: [
        toolCall.message.senderParticipant,
        toolCall.message.responderParticipant
      ].filter((participant): participant is NonNullable<typeof participant> => !!participant)
    });
    let participantMap = new Map(
      participants.map(participant => [participant.id, participant])
    );

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

    let [enriched] = await this.enrichToolCalls([toolCall], {
      bodyLimitBytes: GET_PAYLOAD_LIMIT_BYTES
    });
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
    d: { tenant: Tenant; environment: Environment } & CreateInternalToolCallParams
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
      transport: 'tool_call',
      adapter: d.adapter
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
          allowReservedClientIdentifier: true,
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

    let [enriched] = await this.enrichToolCalls([toolCall], {
      bodyLimitBytes: Number.POSITIVE_INFINITY
    });
    return enriched!;
  }
}

export let toolCallService = Service.create(
  'session',
  () => new toolCallServiceImpl()
).build();
