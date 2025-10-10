import { getFullConfig } from '@metorial/config';
import { db, ID } from '@metorial/db';
import { generatePlainId } from '@metorial/id';
import { createQueue } from '@metorial/queue';
import { Octokit } from '@octokit/core';

export let createRepoWebhookQueue = createQueue<{ repoId: string }>({
  name: 'scm/rep/wh-cr'
});

export let createRepoWebhookQueueProcessor = createRepoWebhookQueue.process(async data => {
  let repo = await db.scmRepo.findUnique({
    where: { id: data.repoId },
    include: { installation: true }
  });
  if (!repo) throw new Error('retry ... not found');

  let octokit = new Octokit({ auth: repo.installation.accessToken });

  let secret = generatePlainId(32);
  let webhookId = await ID.generateId('scmRepoWebhook');

  let wh = await octokit.request('POST /repos/{owner}/{repo}/hooks', {
    owner: repo.externalOwner,
    repo: repo.externalName,
    config: {
      url: `${(await getFullConfig()).urls.integrationsApiUrl}/integrations/scm/webhook-ingest/${webhookId}`,
      content_type: 'json',
      secret,
      insecure_ssl: '0'
    },
    events: ['push', 'pull_request', 'pull_request_review', 'pull_request_review_comment'],
    active: true
  });

  await db.scmRepoWebhook.create({
    data: {
      id: webhookId,
      repoOid: repo.oid,
      externalId: wh.data.id.toString(),
      signingSecret: secret,
      type: 'push'
    }
  });
});
