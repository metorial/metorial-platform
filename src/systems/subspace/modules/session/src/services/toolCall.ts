import { notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type ToolCall,
  type Environment,
  type Session,
  type SessionMessageStatus,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders,
  resolveProviderTools,
  resolveSessionTemplates
} from '@metorial-subspace/list-utils';
import { SenderManager } from '@metorial-subspace/module-connection';
import { env } from '../env';
import { sessionMessageInclude, sessionMessageService } from './sessionMessage';

let include = {
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

class toolCallServiceImpl {
  async enrichToolCalls<T extends ToolCall>(toolCalls: T[]) {
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

  async listToolCalls(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: SessionMessageStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    sessionTemplateIds?: string[];
    sessionProviderIds?: string[];
    providerIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
    providerAuthConfigIds?: string[];
    toolIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let sessionTemplates = await resolveSessionTemplates(d, d.sessionTemplateIds);
    let sessionProviders = await resolveProviders(d, d.sessionProviderIds);
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);
    let tools = await resolveProviderTools(d.toolIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let res = await db.toolCall.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,

            message: normalizeStatusForList(d).onlyParent,

            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,

              tools
                ? {
                    OR: [{ tool: { oid: tools.in } }, { toolKey: { in: d.toolIds ?? [] } }]
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

              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean)
          },
          include
        });

        return await this.enrichToolCalls(res);
      })
    );
  }

  async getToolCallById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    toolCallId: string;
    allowDeleted?: boolean;
  }) {
    let toolCall = await db.toolCall.findFirst({
      where: {
        id: d.toolCallId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,

        message: normalizeStatusForGet(d).onlyParent
      },
      include
    });
    if (!toolCall) throw new ServiceError(notFoundError('tool_call', d.toolCallId));

    let [enriched] = await this.enrichToolCalls([toolCall]);
    return enriched!;
  }

  async createToolCall(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    session: Session;
    input: {
      metadata?: Record<string, any>;
      toolId: string;
      input: Record<string, any>;
    };
  }) {
    checkDeletedRelation(d.session);

    let manager = await SenderManager.create({
      sessionId: d.session.id,
      solutionId: d.solution.id,
      tenantId: d.tenant.id,
      transport: 'tool_call'
    });

    let connection = await db.sessionConnection.findFirst({
      where: {
        state: 'connected',
        sessionOid: d.session.oid,
        isForManualToolCalls: true
      }
    });

    if (!connection) {
      connection = await connectionInitLock.usingLock(d.session.id, async () => {
        let existing = await db.sessionConnection.findFirst({
          where: {
            state: 'connected',
            sessionOid: d.session.oid,
            isForManualToolCalls: true
          }
        });
        if (existing) return existing;

        let connection = await manager.initialize({
          client: {
            name: 'Manual Tool Calls',
            identifier: 'metorial#tool_call'
          },
          mcpTransport: 'none',
          isManualConnection: true
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
