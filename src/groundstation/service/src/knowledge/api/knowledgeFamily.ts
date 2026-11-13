import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { KnowledgeModel, Prisma } from '../../../prisma/generated/client';
import { db } from '../../db';

let compareVersionSort = (a: number[], b: number[]) => {
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    let difference = (a[index] ?? -Infinity) - (b[index] ?? -Infinity);
    if (difference) return difference;
  }

  return 0;
};

export let sortByVersion = (models: KnowledgeModel[]) =>
  [...models].sort(
    (a, b) =>
      compareVersionSort(b.data.versionSort ?? [], a.data.versionSort ?? []) ||
      (b.releaseDate?.getTime() ?? 0) - (a.releaseDate?.getTime() ?? 0) ||
      a.id.localeCompare(b.id)
  );

class KnowledgeFamilyServiceImpl {
  async listFamilies(d: {
    labIds?: string[];
    kinds?: string[];
    statuses?: string[];
    includeRemoved?: boolean;
  }) {
    let where: Prisma.KnowledgeFamilyWhereInput = {
      labId: d.labIds ? { in: d.labIds } : undefined,
      kind: d.kinds ? { in: d.kinds } : undefined,
      status: d.statuses ? { in: d.statuses } : undefined,
      removedAt: d.includeRemoved ? undefined : null
    };

    return Paginator.create(({ prisma }) =>
      prisma(async opts => await db.knowledgeFamily.findMany({ ...opts, where }))
    );
  }

  async getFamilyById(d: { familyId: string }) {
    let family = await db.knowledgeFamily.findUnique({ where: { id: d.familyId } });
    if (!family) throw new ServiceError(notFoundError('knowledge_family', d.familyId));

    let [models, latestModel] = await Promise.all([
      db.knowledgeModel.findMany({ where: { familyId: family.id, removedAt: null } }),
      family.latestModelId
        ? db.knowledgeModel.findUnique({ where: { id: family.latestModelId } })
        : null
    ]);

    return { ...family, models: sortByVersion(models), latestModel };
  }
}

export let knowledgeFamilyService = Service.create(
  'knowledgeFamilyService',
  () => new KnowledgeFamilyServiceImpl()
).build();
