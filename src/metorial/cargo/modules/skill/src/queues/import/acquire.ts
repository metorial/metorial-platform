import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import {
  acquireOriginRepository,
  acquirePublicRepository,
  getImportCodeBucket
} from '../../import/repository';
import { skillImportDiscoverQueue } from './discover';

let importTimeoutMs = 30 * 60 * 1000;

export let skillImportAcquireQueue = createQueue<{ skillImportId: string }>({
  name: 'cargo/skill/import/acquire',
  workerOpts: {
    concurrency: 3
  }
});

let errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Repository acquisition failed';

export let skillImportAcquireQueueProcessor = skillImportAcquireQueue.process(async data => {
  let skillImport = await db.skillImport.findUnique({
    where: { id: data.skillImportId },
    include: {
      resourceTenant: true,
      resourceGroup: true
    }
  });
  if (!skillImport || ['completed', 'failed'].includes(skillImport.status)) return;

  if (Date.now() - skillImport.createdAt.getTime() > importTimeoutMs) {
    await db.skillImport.updateMany({
      where: { id: skillImport.id, status: { in: ['pending', 'processing'] } },
      data: {
        status: 'failed',
        error: 'Repository acquisition timed out',
        completedAt: new Date()
      }
    });
    return;
  }

  try {
    if (skillImport.status === 'pending') {
      let claimed = await db.skillImport.updateMany({
        where: { id: skillImport.id, status: 'pending' },
        data: {
          status: 'processing',
          startedAt: new Date(),
          error: null
        }
      });
      if (claimed.count === 0) return;
    }

    let codeBucketId = skillImport.codeBucketId;
    if (!codeBucketId && skillImport.sourceType === 'public_repository') {
      if (!skillImport.repositoryUrl) throw new Error('Public repository URL is missing');
      codeBucketId = (
        await acquirePublicRepository({
          resourceTenant: skillImport.resourceTenant!,
          repositoryUrl: skillImport.repositoryUrl,
          ref: skillImport.ref
        })
      ).codeBucketId;
      await db.skillImport.update({
        where: { id: skillImport.id },
        data: { codeBucketId }
      });
    } else if (!codeBucketId) {
      if (!skillImport.repositoryId) throw new Error('Origin repository ID is missing');
      let bucket = await acquireOriginRepository({
        resourceTenant: skillImport.resourceTenant!,
        repositoryId: skillImport.repositoryId,
        ref: skillImport.ref,
        path: skillImport.path
      });
      codeBucketId = bucket.id;
      await db.skillImport.update({
        where: { id: skillImport.id },
        data: { codeBucketId }
      });
    }

    if (skillImport.sourceType === 'origin_repository') {
      let bucket = await getImportCodeBucket({
        resourceTenant: skillImport.resourceTenant!,
        codeBucketId
      });
      if (bucket.status === 'importing') {
        await skillImportAcquireQueue.add({ skillImportId: skillImport.id }, { delay: 2000 });
        return;
      }
      if (bucket.status !== 'ready') {
        throw new Error(`Origin codebucket entered unexpected status: ${bucket.status}`);
      }
    }

    await skillImportDiscoverQueue.add(
      { skillImportId: skillImport.id },
      { id: `skillImport:discover:${skillImport.id}` }
    );
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
