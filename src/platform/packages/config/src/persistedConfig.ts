import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { db, withTransaction } from '@metorial/db';

let ensureConfig = async () =>
  await withTransaction(async db => {
    await db.metorialConfig.createMany({ data: { id: 'metorial' }, skipDuplicates: true });
    return await db.metorialConfig.findUniqueOrThrow({ where: { id: 'metorial' } });
  });

ensureConfig().catch(err => {
  console.error('Error initializing metorial config:', err);
});

export let getDistributedConfig = createLocallyCachedFunction({
  getHash: (i: void) => 'config',
  provider: async (i: void) => {
    let config = await db.metorialConfig.findUnique({
      where: { id: 'metorial' }
    });
    return config ?? (await ensureConfig());
  },
  ttlSeconds: 10
});
