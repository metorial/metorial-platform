import { Service } from '@lowerdeck/service';
import { db } from '@metorial/db';
import { getSandboxRegionConfigs } from '../lib/regions';

class SandboxRegionInternalServiceImpl {
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
}

export let sandboxRegionInternalService = Service.create(
  'sandboxRegionInternalService',
  () => new SandboxRegionInternalServiceImpl()
).build();
