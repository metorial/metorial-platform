import { Service } from '@lowerdeck/service';
import { globalDB } from '../db';

class HorizonRepository {
  async registerHorizon(d: { identifier: string; endpointUrl: string }) {
    return await globalDB.horizon.upsert({
      where: { identifier: d.identifier },
      create: {
        identifier: d.identifier,
        endpointUrl: d.endpointUrl
      },
      update: {
        endpointUrl: d.endpointUrl
      }
    });
  }

  async getHorizon(d: { identifier: string }) {
    return await globalDB.horizon.findUnique({
      where: { identifier: d.identifier }
    });
  }
}

export let horizonRepository = Service.create(
  'horizonRepository',
  () => new HorizonRepository()
).build();
