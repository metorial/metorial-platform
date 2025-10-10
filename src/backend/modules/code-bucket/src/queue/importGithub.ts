import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { codeWorkspaceClient } from '../lib/codeWorkspace';

export let importGithubQueue = createQueue<{
  newBucketId: string;
  owner: string;
  repo: string;
  ref: string;
  path: string;
  repoId: string;
}>({
  name: 'cbk/imp/gh'
});

export let importGithubQueueProcessor = importGithubQueue.process(async data => {
  let repo = await db.scmRepo.findFirstOrThrow({
    where: { id: data.repoId },
    include: { installation: true }
  });

  await codeWorkspaceClient.createBucketFromGithub({
    newBucketId: data.newBucketId,
    owner: data.owner,
    repo: data.repo,
    ref: data.ref,
    path: data.path,
    token: repo.installation.accessToken
  });

  await db.codeBucket.updateMany({
    where: { id: data.newBucketId },
    data: { status: 'ready' }
  });
});
