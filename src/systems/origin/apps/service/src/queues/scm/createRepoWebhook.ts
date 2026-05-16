import { generatePlainId } from '@lowerdeck/id';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { ID } from '../../id';
import { createGitHubInstallationClient } from '../../lib/githubApp';
import { createGitLabClientWithToken } from '../../lib/gitlab';

export let createRepoWebhookQueue = createQueue<{ repoId: string }>({
  name: 'ori/rep/wh-cr',
  redisUrl: env.service.REDIS_URL
});

let isPrivateIpv4 = (hostname: string) => {
  let parts = hostname.split('.').map(part => parseInt(part, 10));
  if (
    parts.length !== 4 ||
    parts.some(part => Number.isNaN(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  let [a, b] = parts;
  if (a == null || b == null) return false;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
};

let isLocalOrPrivateWebhookUrl = (url: string) => {
  try {
    let hostname = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '');
    let isIpv6 = hostname.includes(':');

    return (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '::1' ||
      (isIpv6 &&
        (hostname.startsWith('fc') ||
          hostname.startsWith('fd') ||
          hostname.startsWith('fe80'))) ||
      isPrivateIpv4(hostname)
    );
  } catch {
    return true;
  }
};

let shouldIgnoreGitHubHookAlreadyExistsError = (error: any) => {
  if (error.status !== 422) return false;

  if (
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes('hook already exists')
  ) {
    return true;
  }

  let errors = error.response?.data?.errors;
  if (!Array.isArray(errors)) return false;

  return errors.some(
    (e: any) =>
      e.resource === 'Hook' &&
      typeof e.message === 'string' &&
      e.message.toLowerCase().includes('already exists')
  );
};

export let createRepoWebhookQueueProcessor = createRepoWebhookQueue.process(async data => {
  let repo = await db.scmRepository.findUnique({
    where: { id: data.repoId },
    include: { installation: { include: { backend: true } } }
  });
  if (!repo) throw new QueueRetryError();

  let existingWebhook = await db.scmRepositoryWebhook.findUnique({
    where: { repoOid: repo.oid }
  });
  if (existingWebhook) return;

  if (isLocalOrPrivateWebhookUrl(env.service.ORIGIN_SERVICE_PUBLIC_URL)) {
    console.warn(
      `[createRepoWebhook] Skipping webhook creation for repo ${repo.id}: ORIGIN_SERVICE_PUBLIC_URL must be publicly reachable, got ${env.service.ORIGIN_SERVICE_PUBLIC_URL}`
    );
    return;
  }

  let secret = generatePlainId(32);
  let webhookId = await ID.generateId('scmRepositoryWebhook');

  if (repo.provider === 'github') {
    if (!repo.installation.externalInstallationId) {
      throw new Error('Installation ID not found');
    }

    let octokit = await createGitHubInstallationClient(
      repo.installation.externalInstallationId,
      repo.installation.backend
    );

    try {
      let whRes = await octokit.request('POST /repos/{owner}/{repo}/hooks', {
        owner: repo.externalOwner,
        repo: repo.externalName,
        config: {
          url: `${env.service.ORIGIN_SERVICE_PUBLIC_URL}/origin/webhook-ingest/gh/${webhookId}`,
          content_type: 'json',
          secret,
          insecure_ssl: '0'
        },
        events: ['push'],
        active: true
      });

      await db.scmRepositoryWebhook.upsert({
        where: {
          repoOid: repo.oid
        },
        create: {
          id: webhookId,
          repoOid: repo.oid,
          externalId: whRes.data.id.toString(),
          signingSecret: secret,
          type: 'push'
        },
        update: {}
      });
    } catch (error: any) {
      if (shouldIgnoreGitHubHookAlreadyExistsError(error)) {
        console.log(
          `[createRepoWebhook] Webhook already exists for repo ${repo.id}:`,
          error.message
        );
        return;
      }
      throw error;
    }
  }

  if (repo.provider === 'gitlab') {
    if (!repo.installation.accessToken) {
      throw new Error('Access token not found');
    }

    let gitlab = createGitLabClientWithToken(
      repo.installation.accessToken,
      repo.installation.backend
    );

    try {
      let hook = await gitlab.ProjectHooks.add(
        parseInt(repo.externalId),
        `${env.service.ORIGIN_SERVICE_PUBLIC_URL}/origin/webhook-ingest/gl/${webhookId}`,
        {
          pushEvents: true,
          token: secret
        }
      );

      await db.scmRepositoryWebhook.upsert({
        where: {
          repoOid: repo.oid
        },
        create: {
          id: webhookId,
          repoOid: repo.oid,
          externalId: hook.id.toString(),
          signingSecret: secret,
          type: 'push'
        },
        update: {}
      });
    } catch (error: any) {
      // If webhook already exists or validation error, log and continue
      if (error.response?.status === 422 || error.cause?.response?.statusCode === 422) {
        console.log(
          `[createRepoWebhook] Webhook already exists or validation error for GitLab repo ${repo.id}:`,
          error.message
        );
        return;
      }
      throw error;
    }
  }
});
