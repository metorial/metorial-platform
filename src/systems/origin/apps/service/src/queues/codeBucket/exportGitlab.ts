import { createQueue } from '@lowerdeck/queue';
import Long from 'long';
import { db } from '../../db';
import { env } from '../../env';
import { codeBucketClient } from '../../lib/codeWorkspace';
import { codeBucketService } from '../../services/codeBucket';

export let exportGitlabQueue = createQueue<{
  bucketId: string;
  path: string;
  repoId: string;
}>({
  name: 'ori/exp/gl',
  redisUrl: env.service.REDIS_URL
});

export let exportGitlabQueueProcessor = exportGitlabQueue.process(async data => {
  let repo = await db.scmRepository.findFirstOrThrow({
    where: { id: data.repoId },
    include: { installation: { include: { backend: true } } }
  });

  if (!repo.installation.accessToken) {
    throw new Error('Access token not found');
  }

  await codeBucketService.waitForCodeBucketReady({ codeBucketId: data.bucketId });

  // Use GitLab access token
  let token = repo.installation.accessToken;
  let apiUrl = repo.installation.backend.apiUrl;

  await codeBucketClient.exportBucketToGitlab({
    bucketId: data.bucketId,
    projectId: Long.fromString(repo.externalId),
    path: data.path,
    token,
    gitlabApiUrl: apiUrl
  });
});
