import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { Prisma } from '../../../prisma/generated/client';
import { db } from '../../db';
import { keysetPaginator, likePattern } from './keyset';
import { knowledgeOfferingInclude } from './knowledgeOffering';

class KnowledgeModelServiceImpl {
  async listModels(d: {
    labIds?: string[];
    familyIds?: string[];
    kinds?: string[];
    statuses?: string[];
    openWeights?: boolean;
    inputModalities?: string[];
    outputModalities?: string[];
    capabilities?: string[];
    minContextTokens?: number;
    search?: string;
    includeRemoved?: boolean;
  }) {
    let search = d.search?.trim();

    let where = [
      d.labIds && Prisma.sql`m."labId" = ANY(${d.labIds})`,
      d.familyIds && Prisma.sql`m."familyId" = ANY(${d.familyIds})`,
      d.kinds && Prisma.sql`m."kind" = ANY(${d.kinds})`,
      d.statuses && Prisma.sql`m."status" = ANY(${d.statuses})`,
      d.openWeights !== undefined && Prisma.sql`m."openWeights" = ${d.openWeights}`,
      d.inputModalities && Prisma.sql`m."inputModalities" @> ${d.inputModalities}::text[]`,
      d.outputModalities && Prisma.sql`m."outputModalities" @> ${d.outputModalities}::text[]`,
      d.capabilities && Prisma.sql`m."capabilities" @> ${d.capabilities}::text[]`,
      d.minContextTokens !== undefined &&
        Prisma.sql`m."contextTokens" >= ${d.minContextTokens}`,
      search &&
        Prisma.sql`(m."name" ILIKE ${likePattern(search)} OR m."id" ILIKE ${likePattern(search)} OR ${search} <% m."name" OR ${search} <% m."id")`,
      !d.includeRemoved && Prisma.sql`m."removedAt" IS NULL`
    ].filter((condition): condition is Prisma.Sql => !!condition);

    return keysetPaginator({
      from: Prisma.sql`"KnowledgeModel" m`,
      id: Prisma.sql`m."id"`,
      where,
      key: search
        ? () =>
            Prisma.sql`(1 - greatest(word_similarity(${search}, m."name"), word_similarity(${search}, m."id")))`
        : undefined,
      load: async ids => await db.knowledgeModel.findMany({ where: { id: { in: ids } } })
    });
  }

  async getModelById(d: { modelId: string }) {
    let model = await db.knowledgeModel.findUnique({ where: { id: d.modelId } });
    if (!model) throw new ServiceError(notFoundError('knowledge_model', d.modelId));

    let [releases, pointers, offerings] = await Promise.all([
      db.knowledgeRelease.findMany({
        where: { modelId: model.id, removedAt: null },
        orderBy: [{ date: 'desc' }, { id: 'asc' }]
      }),
      db.knowledgePointer.findMany({
        where: { data: { path: ['target', 'modelId'], equals: model.id }, removedAt: null },
        orderBy: { id: 'asc' }
      }),
      db.knowledgeOffering.findMany({
        where: { modelId: model.id, removedAt: null },
        include: knowledgeOfferingInclude,
        orderBy: { id: 'asc' }
      })
    ]);

    return { ...model, releases, pointers, offerings };
  }
}

export let knowledgeModelService = Service.create(
  'knowledgeModelService',
  () => new KnowledgeModelServiceImpl()
).build();
