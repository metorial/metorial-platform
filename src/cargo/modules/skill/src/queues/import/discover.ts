import { createQueue } from '@lowerdeck/queue';
import { db, env, getId, withTransaction } from '@metorial-cargo/db';
import { discoverSkillPaths } from '../../import/discovery';
import { listCodeBucketFiles } from '../../import/repository';
import { skillImportItemQueue } from './item';

export let skillImportDiscoverQueue = createQueue<{ skillImportId: string }>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/import/discover',
  workerOpts: {
    concurrency: 5
  }
});

let errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Skill discovery failed';

export let skillImportDiscoverQueueProcessor = skillImportDiscoverQueue.process(async data => {
  let skillImport = await db.skillImport.findUnique({
    where: { id: data.skillImportId }
  });
  if (!skillImport || skillImport.status !== 'processing' || !skillImport.codeBucketId) return;

  try {
    let files = await listCodeBucketFiles({ codeBucketId: skillImport.codeBucketId });
    let roots = discoverSkillPaths(files.map(file => file.path));
    if (roots.length === 0) throw new Error('No skills were found in the repository');

    let items = await withTransaction(async db => {
      let existing = await db.skillImportItem.findMany({
        where: { skillImportOid: skillImport.oid }
      });
      let existingPaths = new Set(existing.map(item => item.path));
      let newItems = roots
        .filter(root => !existingPaths.has(root))
        .map(root => {
          let itemIds = getId('skillImportItem');
          return {
            ...itemIds,
            path: root,
            targetSkillId: getId('skill').id,
            skillImportOid: skillImport.oid,
            status: 'pending' as const
          };
        });

      if (newItems.length > 0) {
        await db.skillImportItem.createMany({ data: newItems });
      }
      return await db.skillImportItem.findMany({
        where: { skillImportOid: skillImport.oid }
      });
    });

    for (let item of items) {
      if (item.status !== 'pending') continue;
      await skillImportItemQueue.add(
        { skillImportItemId: item.id },
        { id: `skillImport:item:${item.id}` }
      );
    }
  } catch (error) {
    await db.skillImport.updateMany({
      where: { id: skillImport.id, status: 'processing' },
      data: {
        status: 'failed',
        error: errorMessage(error),
        completedAt: new Date()
      }
    });
  }
});
