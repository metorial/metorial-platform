import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db } from '@metorial/db';
import { sandboxRegionInternalService } from '../internal/regionInternal';

class SandboxRegionServiceImpl {
  async list() {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts => await db.sandboxRegion.findMany({ ...opts, where: { status: 'active' } })
      )
    );
  }

  async get(d: { identifier: string }) {
    let region = await db.sandboxRegion.findFirst({
      where: { identifier: d.identifier, status: 'active' }
    });
    if (!region) throw new ServiceError(notFoundError('sandbox_region', d.identifier));

    return region;
  }

  async getByIdentifier(d: { identifier: string }) {
    let find = () =>
      db.sandboxRegion.findFirst({ where: { identifier: d.identifier, status: 'active' } });

    let region = await find();
    if (!region) {
      await sandboxRegionInternalService.syncFromEnv();
      region = await find();
    }

    if (!region) {
      throw new ServiceError(
        badRequestError({ message: `Unknown sandbox region: ${d.identifier}` })
      );
    }

    return region;
  }
}

export let sandboxRegionService = Service.create(
  'sandboxRegionService',
  () => new SandboxRegionServiceImpl()
).build();
