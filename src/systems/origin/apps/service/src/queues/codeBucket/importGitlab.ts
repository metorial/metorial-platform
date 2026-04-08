import { delay } from '@lowerdeck/delay';
import { createQueue } from '@lowerdeck/queue';
import Long from 'long';
import { db } from '../../db';
import { env } from '../../env';
import { codeBucketClient } from '../../lib/codeWorkspace';

export let importGitlabQueue = createQueue<{
  newBucketId: string;
  owner: string;
  repo: string;
  ref: string;
  path: string;
  repoId: string;
}>({
  name: 'ori/imp/gl',
  redisUrl: env.service.REDIS_URL
});

export let importGitlabQueueProcessor = importGitlabQueue.process(async data => {
  let repo = await db.scmRepository.findFirstOrThrow({
    where: { id: data.repoId },
    include: { installation: { include: { backend: true } } }
  });

  if (!repo.installation.accessToken) {
    throw new Error('Access token not found');
  }

  // Use GitLab access token
  let token = repo.installation.accessToken;
  let apiUrl = repo.installation.backend.apiUrl;

  await codeBucketClient.createBucketFromGitlab({
    newBucketId: data.newBucketId,
    projectId: Long.fromString(repo.externalId),
    ref: data.ref,
    path: data.path,
    token,
    gitlabApiUrl: apiUrl
  });

  await delay(2000);

  await db.codeBucket.updateMany({
    where: { id: data.newBucketId },
    data: { status: 'ready' }
  });
});
