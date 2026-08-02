import { createQueue } from '@lowerdeck/queue';
import Long from 'long';
import { db } from '../../db';
import { env } from '../../env';
import { codeBucketClient } from '../../lib/codeWorkspace';
import { getGitLabAccessTokenWithInstallation } from '../../lib/gitlab';
import { runCodeBucketImport } from './importError';

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

  await runCodeBucketImport({
    provider: 'gitlab',
    bucketId: data.newBucketId,
    context: {
      owner: data.owner,
      repo: data.repo,
      ref: data.ref,
      path: data.path,
      repoId: data.repoId,
      projectId: repo.externalId
    },
    importFn: async () => {
      let token = await getGitLabAccessTokenWithInstallation(repo.installation);
      let apiUrl = repo.installation.backend.apiUrl;

      await codeBucketClient.createBucketFromGitlab({
        newBucketId: data.newBucketId,
        projectId: Long.fromString(repo.externalId),
        ref: data.ref,
        path: data.path,
        token,
        gitlabApiUrl: apiUrl
      });
    }
  });
});
