import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { codeBucketClient } from '../../lib/codeWorkspace';
import { getInstallationAccessToken } from '../../lib/githubApp';
import { codeBucketService } from '../../services/codeBucket';

export let exportGithubQueue = createQueue<{
  bucketId: string;
  path: string;
  repoId: string;
}>({
  name: 'ori/exp/gh',
  redisUrl: env.service.REDIS_URL
});

export let exportGithubQueueProcessor = exportGithubQueue.process(async data => {
  let repo = await db.scmRepository.findFirstOrThrow({
    where: { id: data.repoId },
    include: { installation: { include: { backend: true } } }
  });
  if (!repo.installation.externalInstallationId) {
    throw new Error('Installation ID not found');
  }

  await codeBucketService.waitForCodeBucketReady({ codeBucketId: data.bucketId });

  // Get a fresh installation access token
  let token = await getInstallationAccessToken(
    repo.installation.externalInstallationId,
    repo.installation.backend
  );

  await codeBucketClient.exportBucketToGithub({
    bucketId: data.bucketId,
    owner: repo.externalOwner,
    repo: repo.externalName,
    path: data.path,
    token
  });
});
