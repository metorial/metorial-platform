import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db } from '@metorial/db';
import { getSandboxRegionConfigs } from '../lib/regions';

class SandboxRegionServiceImpl {
  async syncFromEnv() {
    let configs = getSandboxRegionConfigs();

    for (let config of configs) {
      let data = {
        status: 'active' as const,
        identifier: config.identifier,
        name: config.name,
        cloud: config.cloud,
        areaId: config.area.id,
        areaName: config.area.name
      };

      await db.sandboxRegion.upsert({
        where: { id: config.id },
        create: { id: config.id, ...data },
        update: data
      });
    }

    await db.sandboxRegion.updateMany({
      where: { id: { notIn: configs.map(config => config.id) }, status: 'active' },
      data: { status: 'deleted' }
    });
  }

  async list() {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts => await db.sandboxRegion.findMany({ ...opts, where: { status: 'active' } })
      )
    );
  }

  async getByIdentifier(d: { identifier: string }) {
    let find = () =>
      db.sandboxRegion.findFirst({ where: { identifier: d.identifier, status: 'active' } });

    let region = await find();
    if (!region) {
      await this.syncFromEnv();
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
