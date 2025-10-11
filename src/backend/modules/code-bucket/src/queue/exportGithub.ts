import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { codeWorkspaceClient } from '../lib/codeWorkspace';
import { codeBucketService } from '../services';

export let exportGithubQueue = createQueue<{
  bucketId: string;
  path: string;
  repoId: string;
}>({
  name: 'cbk/exp/gh'
});

export let exportGithubQueueProcessor = exportGithubQueue.process(async data => {
  let repo = await db.scmRepo.findFirstOrThrow({
    where: { id: data.repoId },
    include: { installation: true }
  });

  await codeBucketService.waitForCodeBucketReady({ codeBucketId: data.bucketId });

  await codeWorkspaceClient.exportBucketToGithub({
    bucketId: data.bucketId,
    owner: repo.externalOwner,
    repo: repo.externalName,
    path: data.path,
    token: repo.installation.accessToken
  });
});
