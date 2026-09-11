import { createCron } from '@lowerdeck/cron';
import { createRootRegistryClient } from '@metorial-services/registry-client';
import { slates } from '../../client';
import { env } from '../../env';

let registryClient = env.service.REGISTRY_URL
  ? createRootRegistryClient({
      endpoint: env.service.REGISTRY_URL
    })
  : null;

export let syncRegistriesCron = createCron(
  {
    name: 'sub/slt/sync/registries',
    redisUrl: env.service.REDIS_URL,
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    if (!registryClient) return;

    let registries = await registryClient.registry.list({});
    let slatesRegistries = registries.filter(r => r.from.type === 'slates');

    let allCurrentSlatesRegistries = (await slates.registry.listAll({})).filter(
      r => !r.tenant
    );
    let registriesToCreate = slatesRegistries.filter(
      r => !allCurrentSlatesRegistries.some(sr => sr.url === r.from.url)
    );

    for (let registry of registriesToCreate) {
      await slates.registry.create({
        registryUrl: registry.from.url
      });
    }
  }
);
