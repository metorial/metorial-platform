import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type ProviderType } from '@metorial-subspace/db';

let providerTypeByIdCache = new Map<string, ProviderType>();
let providerTypeByOidCache = new Map<number, ProviderType>();

let cacheProviderType = (providerType: ProviderType) => {
  providerTypeByIdCache.set(providerType.id, providerType);
  providerTypeByOidCache.set(providerType.oid, providerType);
};

class providerTypeServiceImpl {
  async listProviderTypes(d: { ids?: string[] } = {}) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let providerTypes = await db.providerType.findMany({
          ...opts,
          where: {
            id: d.ids ? { in: d.ids } : undefined
          },
          orderBy: { id: 'asc' }
        });

        for (let providerType of providerTypes) {
          cacheProviderType(providerType);
        }

        return providerTypes;
      })
    );
  }

  async getProviderTypeById(d: { providerTypeId: string }) {
    let cached = providerTypeByIdCache.get(d.providerTypeId);
    if (cached) return cached;

    let providerType = await db.providerType.findFirst({
      where: { id: d.providerTypeId }
    });
    if (!providerType) {
      throw new ServiceError(notFoundError('provider.type', d.providerTypeId));
    }

    cacheProviderType(providerType);

    return providerType;
  }

  async getProviderTypeByOid(d: { providerTypeOid: number }) {
    let cached = providerTypeByOidCache.get(d.providerTypeOid);
    if (cached) return cached;

    let providerType = await db.providerType.findUnique({
      where: { oid: d.providerTypeOid }
    });
    if (!providerType) {
      throw new ServiceError(
        notFoundError('provider.type', d.providerTypeOid.toString())
      );
    }

    cacheProviderType(providerType);

    return providerType;
  }
}

export let providerTypeService = Service.create(
  'providerTypeService',
  () => new providerTypeServiceImpl()
).build();
