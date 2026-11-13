import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  KnowledgeOrganization,
  KnowledgeVendor,
  Prisma
} from '../../../prisma/generated/client';
import { db } from '../../db';

export type KnowledgeLab = KnowledgeOrganization & {
  familyCount: number;
  modelCount: number;
  firstPartyVendors: KnowledgeVendor[];
};

class KnowledgeLabServiceImpl {
  async listLabs(d: { statuses?: string[]; includeRemoved?: boolean }) {
    let where: Prisma.KnowledgeOrganizationWhereInput = {
      roles: { has: 'lab' },
      status: d.statuses ? { in: d.statuses } : undefined,
      removedAt: d.includeRemoved ? undefined : null
    };

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        this.withDetails(await db.knowledgeOrganization.findMany({ ...opts, where }))
      )
    );
  }

  async getLabById(d: { labId: string }) {
    let lab = await db.knowledgeOrganization.findFirst({
      where: { id: d.labId, roles: { has: 'lab' } }
    });
    if (!lab) throw new ServiceError(notFoundError('knowledge_lab', d.labId));

    return (await this.withDetails([lab]))[0]!;
  }

  private async withDetails(labs: KnowledgeOrganization[]): Promise<KnowledgeLab[]> {
    let ids = labs.map(lab => lab.id);

    let [families, models, vendors] = await Promise.all([
      db.knowledgeFamily.groupBy({
        by: ['labId'],
        where: { labId: { in: ids }, removedAt: null },
        _count: { _all: true }
      }),
      db.knowledgeModel.groupBy({
        by: ['labId'],
        where: { labId: { in: ids }, removedAt: null },
        _count: { _all: true }
      }),
      db.knowledgeVendor.findMany({
        where: { organizationId: { in: ids }, kind: 'first-party', removedAt: null },
        orderBy: { id: 'asc' }
      })
    ]);

    return labs.map(lab => ({
      ...lab,
      familyCount: families.find(row => row.labId == lab.id)?._count._all ?? 0,
      modelCount: models.find(row => row.labId == lab.id)?._count._all ?? 0,
      firstPartyVendors: vendors.filter(vendor => vendor.organizationId == lab.id)
    }));
  }
}

export let knowledgeLabService = Service.create(
  'knowledgeLabService',
  () => new KnowledgeLabServiceImpl()
).build();
