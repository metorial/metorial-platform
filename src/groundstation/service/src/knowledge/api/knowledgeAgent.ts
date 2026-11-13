import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma } from '../../../prisma/generated/client';
import { db } from '../../db';

class KnowledgeAgentServiceImpl {
  async listAgents(d: {
    makerIds?: string[];
    surfaces?: string[];
    vendorIds?: string[];
    openSource?: boolean;
    statuses?: string[];
    includeRemoved?: boolean;
  }) {
    let where: Prisma.KnowledgeAgentWhereInput = {
      makerId: d.makerIds ? { in: d.makerIds } : undefined,
      surfaces: d.surfaces ? { hasSome: d.surfaces } : undefined,
      vendorIds: d.vendorIds ? { hasSome: d.vendorIds } : undefined,
      openSource: d.openSource,
      status: d.statuses ? { in: d.statuses } : undefined,
      removedAt: d.includeRemoved ? undefined : null
    };

    return Paginator.create(({ prisma }) =>
      prisma(async opts => await db.knowledgeAgent.findMany({ ...opts, where }))
    );
  }

  async getAgentById(d: { agentId: string }) {
    let agent = await db.knowledgeAgent.findUnique({ where: { id: d.agentId } });
    if (!agent) throw new ServiceError(notFoundError('knowledge_agent', d.agentId));

    return agent;
  }
}

export let knowledgeAgentService = Service.create(
  'knowledgeAgentService',
  () => new KnowledgeAgentServiceImpl()
).build();
