import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createLocallyCachedFunction } from '@metorial/cache';
import { db, type SandboxRegion } from '@metorial/db';

let SPEC_CACHE_TTL_SECONDS = 60;

export let sandboxSpecInclude = {
  regions: { where: { status: 'active' }, include: { region: true } }
} as const;

let getSpecCached = createLocallyCachedFunction({
  getHash: (i: { specId: string }) => i.specId,
  ttlSeconds: SPEC_CACHE_TTL_SECONDS,
  provider: async i => {
    let spec = await db.sandboxSpec.findFirst({
      where: { id: i.specId, status: 'active' },
      include: sandboxSpecInclude
    });
    if (!spec) throw new ServiceError(notFoundError('sandbox_spec', i.specId));

    return spec;
  }
});

class SandboxSpecServiceImpl {
  async list() {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sandboxSpec.findMany({
            ...opts,
            where: { status: 'active' },
            include: sandboxSpecInclude
          })
      )
    );
  }

  async get(d: { specId: string }) {
    return await getSpecCached({ specId: d.specId });
  }

  async resolve(d: { specId: string; region: SandboxRegion }) {
    let spec = await this.get({ specId: d.specId });

    let regional = spec.regions.find(regional => regional.regionOid == d.region.oid);
    if (!regional) {
      throw new ServiceError(
        badRequestError({
          message: `Spec ${spec.id} is not available in region ${d.region.identifier}`
        })
      );
    }

    return { spec, regional };
  }
}

export let sandboxSpecService = Service.create(
  'sandboxSpecService',
  () => new SandboxSpecServiceImpl()
).build();
