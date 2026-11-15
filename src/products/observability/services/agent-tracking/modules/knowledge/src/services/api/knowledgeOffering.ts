import { Service } from '@lowerdeck/service';
import { Prisma } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';
import { keysetPaginator, type SortOrder } from '../../lib/api/keyset';

export let knowledgeOfferingSorts = ['id', 'input_price', 'output_price'] as const;

export type KnowledgeOfferingSort = (typeof knowledgeOfferingSorts)[number];

export let knowledgeOfferingInclude = {
  openPricePeriod: true
} satisfies Prisma.KnowledgeOfferingInclude;

export type KnowledgeOfferingWithPrice = Prisma.KnowledgeOfferingGetPayload<{
  include: typeof knowledgeOfferingInclude;
}>;

let priceKey = (rate: 'input' | 'output') => (order: SortOrder) =>
  Prisma.sql`coalesce((p."pricing"->'text'->>${rate})::double precision, ${Prisma.raw(order == 'asc' ? `'Infinity'` : `'-Infinity'`)}::double precision)`;

class KnowledgeOfferingServiceImpl {
  async listOfferings(d: {
    modelIds?: string[];
    familyIds?: string[];
    labIds?: string[];
    vendorIds?: string[];
    variantKeys?: string[];
    free?: boolean;
    kinds?: string[];
    statuses?: string[];
    priced?: boolean;
    includeRemoved?: boolean;
    sort?: KnowledgeOfferingSort;
  }) {
    let where = [
      d.modelIds && Prisma.sql`o."modelId" = ANY(${d.modelIds})`,
      d.familyIds &&
        Prisma.sql`o."modelId" IN (SELECT fm."id" FROM "KnowledgeModel" fm WHERE fm."familyId" = ANY(${d.familyIds}))`,
      d.labIds &&
        Prisma.sql`o."modelId" IN (SELECT lm."id" FROM "KnowledgeModel" lm WHERE lm."labId" = ANY(${d.labIds}))`,
      d.vendorIds && Prisma.sql`o."vendorId" = ANY(${d.vendorIds})`,
      d.variantKeys && Prisma.sql`o."variantKey" = ANY(${d.variantKeys})`,
      d.free !== undefined && Prisma.sql`o."free" = ${d.free}`,
      d.kinds && Prisma.sql`o."kind" = ANY(${d.kinds})`,
      d.statuses && Prisma.sql`o."status" = ANY(${d.statuses})`,
      d.priced !== undefined &&
        (d.priced ? Prisma.sql`p."oid" IS NOT NULL` : Prisma.sql`p."oid" IS NULL`),
      !d.includeRemoved && Prisma.sql`o."removedAt" IS NULL`
    ].filter((condition): condition is Prisma.Sql => !!condition);

    return keysetPaginator({
      from: Prisma.sql`"KnowledgeOffering" o LEFT JOIN "KnowledgePricePeriod" p ON p."openOfferingOid" = o."oid"`,
      id: Prisma.sql`o."id"`,
      where,
      key:
        d.sort == 'input_price'
          ? priceKey('input')
          : d.sort == 'output_price'
            ? priceKey('output')
            : undefined,
      load: async ids =>
        await db.knowledgeOffering.findMany({
          where: { id: { in: ids } },
          include: knowledgeOfferingInclude
        })
    });
  }
}

export let knowledgeOfferingService = Service.create(
  'knowledgeOfferingService',
  () => new KnowledgeOfferingServiceImpl()
).build();
