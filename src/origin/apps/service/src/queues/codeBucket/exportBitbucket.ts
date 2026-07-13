import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getBitbucketAccessTokenWithInstallation } from '../../lib/bitbucket';
import { codeBucketClient } from '../../lib/codeWorkspace';
import { codeBucketService } from '../../services/codeBucket';
import { getBitbucketCloneUrl } from './bitbucket';

export let exportBitbucketQueue = createQueue<{
  bucketId: string;
  path: string;
  repoId: string;
  branchName?: string;
  commitMessage?: string;
}>({
  name: 'ori/exp/bb',
  redisUrl: env.service.REDIS_URL
});

export let exportBitbucketQueueProcessor = exportBitbucketQueue.process(async data => {
  let repo = await db.scmRepository.findFirstOrThrow({
    where: { id: data.repoId },
    include: { installation: { include: { backend: true } } }
  });

  await codeBucketService.waitForCodeBucketReady({ codeBucketId: data.bucketId });

  let token = await getBitbucketAccessTokenWithInstallation(repo.installation);
  let branch = data.branchName ?? repo.defaultBranch ?? 'main';
  let commitMessage = data.commitMessage ?? `Export code bucket ${data.bucketId}`;

  if (repo.installation.backend.type === 'bitbucket_data_center') {
    await codeBucketClient.exportBucketToBitbucketDataCenter({
      bucketId: data.bucketId,
      cloneUrl: getBitbucketCloneUrl(repo),
      path: data.path,
      branch,
      commitMessage,
      username: '',
      token
    });
  } else {
    await codeBucketClient.exportBucketToBitbucketCloud({
      bucketId: data.bucketId,
      workspace: repo.externalOwner,
      repo: repo.externalName,
      path: data.path,
      branch,
      commitMessage,
      token,
      bitbucketApiUrl: repo.installation.backend.apiUrl,
      bitbucketWebUrl: repo.installation.backend.webUrl
    });
  }
});
