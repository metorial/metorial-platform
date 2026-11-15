import { fileReferenceService } from '@metorial/module-file';
import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import {
  acquireOriginRepository,
  acquirePublicRepository,
  acquireUploadedSkillFile,
  getImportCodeBucket
} from '../lib/repository';
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

export let releaseSkillImportSourceFile = async (skillImport: {
  id: string;
  sourceFileReference?: { id: string } | null;
}) => {
  if (!skillImport.sourceFileReference) return;
  await fileReferenceService.deleteFileReferenceByIdAndCleanup({
    fileReferenceId: skillImport.sourceFileReference.id
  });
  await db.skillImport.updateMany({
    where: { id: skillImport.id },
    data: {
      sourceFileReferenceOid: null,
      sourceFileLinkOid: null
    }
  });
};

let tryReleaseSourceFile = async (
  skillImport: Parameters<typeof releaseSkillImportSourceFile>[0]
) => {
  try {
    await releaseSkillImportSourceFile(skillImport);
  } catch {
    // Recovery retries terminal imports whose source reference is still attached.
  }
};

export let skillImportAcquireQueueProcessor = skillImportAcquireQueue.process(async data => {
  let skillImport = await db.skillImport.findUnique({
    where: { id: data.skillImportId },
    include: {
      sourceFile: true,
      sourceFileReference: true,
      project: true
    }
  });
  if (!skillImport || ['completed', 'failed'].includes(skillImport.status)) return;

  if (Date.now() - skillImport.createdAt.getTime() > importTimeoutMs) {
    await tryReleaseSourceFile(skillImport);
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
          project: skillImport.project,
          repositoryUrl: skillImport.repositoryUrl,
          ref: skillImport.ref
        })
      ).codeBucketId;
      await db.skillImport.update({
        where: { id: skillImport.id },
        data: { codeBucketId }
      });
    } else if (!codeBucketId && skillImport.sourceType === 'origin_repository') {
      if (!skillImport.repositoryId) throw new Error('Origin repository ID is missing');
      let bucket = await acquireOriginRepository({
        project: skillImport.project,
        repositoryId: skillImport.repositoryId,
        ref: skillImport.ref,
        path: skillImport.path
      });
      codeBucketId = bucket.id;
      await db.skillImport.update({
        where: { id: skillImport.id },
        data: { codeBucketId }
      });
    } else if (!codeBucketId) {
      if (!skillImport.sourceFile || !skillImport.sourceFileFormat) {
        throw new Error('Uploaded skill source file is missing');
      }
      codeBucketId = (
        await acquireUploadedSkillFile({
          project: skillImport.project,
          file: skillImport.sourceFile,
          format: skillImport.sourceFileFormat
        })
      ).codeBucketId;
      await db.skillImport.update({
        where: { id: skillImport.id },
        data: { codeBucketId }
      });
    }

    if (skillImport.sourceType === 'origin_repository') {
      let bucket: any = await getImportCodeBucket({
        project: skillImport.project,
        codeBucketId
      });
      if (bucket.status === 'importing') {
        await skillImportAcquireQueue.add({ skillImportId: skillImport.id }, { delay: 2000 });
        return;
      }
      if (bucket.status === 'failed') {
        throw new Error(
          bucket.errorMessage ??
            'The repository could not be imported. It may have been deleted or is no longer accessible.'
        );
      }
      if (bucket.status !== 'ready') {
        throw new Error(`Origin codebucket entered unexpected status: ${bucket.status}`);
      }
    }

    await tryReleaseSourceFile(skillImport);
    await skillImportDiscoverQueue.add(
      { skillImportId: skillImport.id },
      { id: `skillImport:discover:${skillImport.id}` }
    );
  } catch (error) {
    await tryReleaseSourceFile(skillImport);
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
