import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Tenant } from '@metorial-subspace/db';
import { type DateFilter, normalizeDateFilter } from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import {
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';

let include = {};

type GetPublisherByIdParams = {
  publisherId: string;
};

type ListPublishersParams = {
  search?: string;
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

class publisherServiceImpl {
  async getPublisherById(d: MetorialFacing<GetPublisherByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getPublisherByIdInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async getPublisherByIdInternal(
    d: {
      tenant?: Tenant;
    } & GetPublisherByIdParams
  ) {
    let publisher = await db.publisher.findFirst({
      where: {
        AND: [
          {
            OR: [
              { id: d.publisherId },
              { identifier: d.publisherId },
              { tenant: { id: d.publisherId } },
              { tenant: { identifier: d.publisherId } }
            ]
          },

          {
            OR: [
              { type: 'metorial' as const },
              { type: 'external' as const },
              ...(d.tenant ? [{ type: 'tenant' as const, tenantOid: d.tenant.oid }] : [])
            ]
          }
        ]
      },
      include
    });
    if (!publisher) {
      throw new ServiceError(notFoundError('publisher', d.publisherId));
    }

    return publisher;
  }

  async listPublishers(d: MetorialFacing<ListPublishersParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listPublishersInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async listPublishersInternal(
    d: {
      tenant?: Tenant;
    } & ListPublishersParams
  ) {
    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant?.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.publisher.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.publisher.findMany({
            ...opts,
            where: {
              OR: [
                { type: 'metorial' as const },
                { type: 'external' as const },
                ...(d.tenant ? [{ type: 'tenant' as const, tenantOid: d.tenant.oid }] : [])
              ],

              id: search ? { in: search.map(r => r.documentId) } : undefined!,

              AND: [
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }
}

export let publisherService = Service.create(
  'publisherService',
  () => new publisherServiceImpl()
).build();
