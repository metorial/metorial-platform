import { delay } from '@lowerdeck/delay';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getBitbucketAccessTokenWithInstallation } from '../../lib/bitbucket';
import { codeBucketClient } from '../../lib/codeWorkspace';
import { getBitbucketCloneUrl } from './bitbucket';

export let importBitbucketQueue = createQueue<{
  newBucketId: string;
  ref: string;
  path: string;
  repoId: string;
}>({
  name: 'ori/imp/bb',
  redisUrl: env.service.REDIS_URL
});

export let importBitbucketQueueProcessor = importBitbucketQueue.process(async data => {
  let repo = await db.scmRepository.findFirstOrThrow({
    where: { id: data.repoId },
    include: { installation: { include: { backend: true } } }
  });
  let token = await getBitbucketAccessTokenWithInstallation(repo.installation);

  if (repo.installation.backend.type === 'bitbucket_data_center') {
    await codeBucketClient.createBucketFromBitbucketDataCenter({
      newBucketId: data.newBucketId,
      cloneUrl: getBitbucketCloneUrl(repo),
      path: data.path,
      ref: data.ref,
      username: '',
      token
    });
  } else {
    await codeBucketClient.createBucketFromBitbucketCloud({
      newBucketId: data.newBucketId,
      workspace: repo.externalOwner,
      repo: repo.externalName,
      path: data.path,
      ref: data.ref,
      token,
      bitbucketWebUrl: repo.installation.backend.webUrl
    });
  }

  await delay(2000);
  await db.codeBucket.updateMany({
    where: { id: data.newBucketId },
    data: { status: 'ready' }
  });
});
