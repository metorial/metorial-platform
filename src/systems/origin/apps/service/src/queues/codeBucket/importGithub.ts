import { delay } from '@lowerdeck/delay';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { codeBucketClient } from '../../lib/codeWorkspace';
import { getInstallationAccessToken } from '../../lib/githubApp';

export let importGithubQueue = createQueue<{
  newBucketId: string;
  owner: string;
  repo: string;
  ref: string;
  path: string;
  repoId: string;
}>({
  name: 'ori/imp/gh',
  redisUrl: env.service.REDIS_URL
});

export let importGithubQueueProcessor = importGithubQueue.process(async data => {
  let repo = await db.scmRepository.findFirstOrThrow({
    where: { id: data.repoId },
    include: { installation: { include: { backend: true } } }
  });
  if (!repo.installation.externalInstallationId) {
    throw new Error('Installation ID not found');
  }

  // Get a fresh installation access token
  let token = await getInstallationAccessToken(
    repo.installation.externalInstallationId,
    repo.installation.backend
  );

  await codeBucketClient.createBucketFromGithub({
    newBucketId: data.newBucketId,
    owner: data.owner,
    repo: data.repo,
    ref: data.ref,
    path: data.path,
    token
  });

  await delay(2000);

  await db.codeBucket.updateMany({
    where: { id: data.newBucketId },
    data: { status: 'ready' }
  });
});
