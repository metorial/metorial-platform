import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { KnowledgeEndpoint, KnowledgeVendor, Prisma } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';

export type KnowledgeVendorWithDetails = KnowledgeVendor & {
  endpoints: KnowledgeEndpoint[];
  offeringCount: number;
};

class KnowledgeVendorServiceImpl {
  async listVendors(d: {
    kinds?: string[];
    organizationIds?: string[];
    statuses?: string[];
    includeRemoved?: boolean;
  }) {
    let where: Prisma.KnowledgeVendorWhereInput = {
      kind: d.kinds ? { in: d.kinds } : undefined,
      organizationId: d.organizationIds ? { in: d.organizationIds } : undefined,
      status: d.statuses ? { in: d.statuses } : undefined,
      removedAt: d.includeRemoved ? undefined : null
    };

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        this.withDetails(await db.knowledgeVendor.findMany({ ...opts, where }))
      )
    );
  }

  async getVendorById(d: { vendorId: string }) {
    let vendor = await db.knowledgeVendor.findUnique({ where: { id: d.vendorId } });
    if (!vendor) throw new ServiceError(notFoundError('knowledge_vendor', d.vendorId));

    return (await this.withDetails([vendor]))[0]!;
  }

  private async withDetails(
    vendors: KnowledgeVendor[]
  ): Promise<KnowledgeVendorWithDetails[]> {
    let ids = vendors.map(vendor => vendor.id);

    let [endpoints, offerings] = await Promise.all([
      db.knowledgeEndpoint.findMany({
        where: { vendorId: { in: ids }, removedAt: null },
        orderBy: { id: 'asc' }
      }),
      db.knowledgeOffering.groupBy({
        by: ['vendorId'],
        where: { vendorId: { in: ids }, removedAt: null },
        _count: { _all: true }
      })
    ]);

    return vendors.map(vendor => ({
      ...vendor,
      endpoints: endpoints.filter(endpoint => endpoint.vendorId == vendor.id),
      offeringCount: offerings.find(row => row.vendorId == vendor.id)?._count._all ?? 0
    }));
  }
}

export let knowledgeVendorService = Service.create(
  'knowledgeVendorService',
  () => new KnowledgeVendorServiceImpl()
).build();
