import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { Prisma } from '../../../prisma/generated/client';
import { db } from '../../db';
import { keysetPaginator } from './keyset';

export let knowledgePricePeriodInclude = {
  offering: { select: { id: true } }
} satisfies Prisma.KnowledgePricePeriodInclude;

export type KnowledgePricePeriodWithOffering = Prisma.KnowledgePricePeriodGetPayload<{
  include: typeof knowledgePricePeriodInclude;
}>;

class KnowledgePriceServiceImpl {
  async listPriceHistory(d: {
    offeringId?: string;
    modelId?: string;
    familyId?: string;
    vendorId?: string;
    from?: Date;
    to?: Date;
  }) {
    if (!d.offeringId && !d.modelId && !d.familyId && !d.vendorId) {
      throw new ServiceError(
        badRequestError({
          message: 'Pass an offeringId, modelId, familyId or vendorId.'
        })
      );
    }
    if (d.from && d.to && d.from >= d.to) {
      throw new ServiceError(badRequestError({ message: '`from` must be before `to`.' }));
    }

    let offering = await this.loadTargets(d);

    let where = [
      offering && Prisma.sql`p."offeringOid" = ${offering.oid}`,
      d.modelId && Prisma.sql`p."modelId" = ${d.modelId}`,
      d.familyId &&
        Prisma.sql`p."modelId" IN (SELECT fm."id" FROM "KnowledgeModel" fm WHERE fm."familyId" = ${d.familyId})`,
      d.vendorId && Prisma.sql`p."vendorId" = ${d.vendorId}`,
      d.from && Prisma.sql`(p."validTo" IS NULL OR p."validTo" > ${d.from})`,
      d.to && Prisma.sql`p."validFrom" < ${d.to}`
    ].filter((condition): condition is Prisma.Sql => !!condition);

    return keysetPaginator({
      from: Prisma.sql`"KnowledgePricePeriod" p`,
      id: Prisma.sql`p."id"`,
      where,
      key: () => Prisma.sql`extract(epoch FROM p."validFrom")`,
      load: async ids =>
        await db.knowledgePricePeriod.findMany({
          where: { id: { in: ids } },
          include: knowledgePricePeriodInclude
        })
    });
  }

  private async loadTargets(d: {
    offeringId?: string;
    modelId?: string;
    familyId?: string;
    vendorId?: string;
  }) {
    let [offering, model, family, vendor] = await Promise.all([
      d.offeringId ? db.knowledgeOffering.findUnique({ where: { id: d.offeringId } }) : null,
      d.modelId ? db.knowledgeModel.findUnique({ where: { id: d.modelId } }) : null,
      d.familyId ? db.knowledgeFamily.findUnique({ where: { id: d.familyId } }) : null,
      d.vendorId ? db.knowledgeVendor.findUnique({ where: { id: d.vendorId } }) : null
    ]);

    if (d.offeringId && !offering) {
      throw new ServiceError(notFoundError('knowledge_offering', d.offeringId));
    }
    if (d.modelId && !model)
      throw new ServiceError(notFoundError('knowledge_model', d.modelId));
    if (d.familyId && !family) {
      throw new ServiceError(notFoundError('knowledge_family', d.familyId));
    }
    if (d.vendorId && !vendor) {
      throw new ServiceError(notFoundError('knowledge_vendor', d.vendorId));
    }

    return offering;
  }
}

export let knowledgePriceService = Service.create(
  'knowledgePriceService',
  () => new KnowledgePriceServiceImpl()
).build();
