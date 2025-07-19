import { createLocallyCachedFunction } from '@metorial/cache';
import { db } from '@metorial/db';

db.metorialConfig
  .upsert({
    where: { id: 'metorial' },
    update: {},
    create: {}
  })
  .catch(err => {
    console.error('Error initializing metorial config:', err);
  });

export let getDistributedConfig = createLocallyCachedFunction({
  getHash: (i: void) => 'config',
  provider: async (i: void) => {
    let config = await db.metorialConfig.findFirst({
      where: { id: 'metorial' }
    });
    if (config) return config;

    return db.metorialConfig.upsert({
      where: { id: 'metorial' },
      update: {},
      create: {}
    });
  },
  ttlSeconds: 10
});
