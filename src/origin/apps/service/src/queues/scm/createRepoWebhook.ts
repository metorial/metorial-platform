import { generatePlainId } from '@lowerdeck/id';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { ID } from '../../id';
import {
  createProviderRepositoryWebhook,
  deleteProviderRepositoryWebhook,
  equalRepositoryWebhookEvents,
  getDesiredRepositoryWebhookEvents,
  getRepositoryWebhookCallbackUrl,
  listManagedProviderRepositoryWebhooks,
  readProviderRepositoryWebhook,
  updateProviderRepositoryWebhook
} from '../../lib/scmRepositoryWebhook';
import {
  getScmProviderErrorDetails,
  getScmProviderErrorStatus
} from '../../lib/scmProviderError';

let webhookReconcileBlockDurationMs = 7 * 24 * 60 * 60_000;

export let createRepoWebhookQueue = createQueue<{ repoId: string }>({
  name: 'ori/rep/wh-cr',
  redisUrl: env.service.REDIS_URL,
  jobOpts: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5_000 }
  },
  workerOpts: {
    concurrency: 5,
    limiter: { max: 10, duration: 1_000 }
  }
});

let isPrivateIpv4 = (hostname: string) => {
  let parts = hostname.split('.').map(part => parseInt(part, 10));
  if (parts.length !== 4 || parts.some(part => Number.isNaN(part) || part < 0 || part > 255)) {
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

export let isLocalOrPrivateWebhookUrl = (url: string) => {
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

let isAlreadyExistsError = (error: unknown) => {
  let details = getScmProviderErrorDetails(error);
  return (
    details.status === 409 ||
    Boolean(details.description?.toLowerCase().includes('already exists'))
  );
};

export let shouldBlockRepositoryWebhookReconcile = (error: unknown) => {
  let details = getScmProviderErrorDetails(error);
  if (isAlreadyExistsError(error)) return false;
  return [
    'authentication_failed',
    'permission_denied',
    'resource_not_found',
    'invalid_request'
  ].includes(details.classification);
};

let blockRepositoryWebhookReconcile = async (repoOid: bigint, error: unknown) => {
  let details = getScmProviderErrorDetails(error);
  let blockedUntil = new Date(Date.now() + webhookReconcileBlockDurationMs);
  let reason = [details.classification, details.status, details.description]
    .filter(value => value != null && value !== '')
    .join(': ')
    .slice(0, 1_000);

  await db.scmRepository.update({
    where: { oid: repoOid },
    data: {
      webhookReconcileBlockedUntil: blockedUntil,
      webhookReconcileBlockedReason: reason
    }
  });

  console.warn(
    JSON.stringify({
      event: 'scm_webhook_reconcile_blocked',
      repoOid: repoOid.toString(),
      blockedUntil: blockedUntil.toISOString(),
      providerError: details
    })
  );
};

let clearRepositoryWebhookReconcileBlock = async (repo: {
  oid: bigint;
  webhookReconcileBlockedUntil: Date | null;
  webhookReconcileBlockedReason: string | null;
}) => {
  if (!repo.webhookReconcileBlockedUntil && !repo.webhookReconcileBlockedReason) return;
  await db.scmRepository.update({
    where: { oid: repo.oid },
    data: {
      webhookReconcileBlockedUntil: null,
      webhookReconcileBlockedReason: null
    }
  });
};

let removeManagedWebhooks = async (
  repo: Parameters<typeof listManagedProviderRepositoryWebhooks>[0],
  exceptExternalId?: string
) => {
  let hooks = await listManagedProviderRepositoryWebhooks(repo);
  for (let hook of hooks) {
    if (hook.id === exceptExternalId) continue;
    try {
      await deleteProviderRepositoryWebhook(repo, hook.id);
    } catch (error) {
      if (getScmProviderErrorStatus(error) !== 404) throw error;
    }
  }
};

let createAndConfirmWebhook = async (
  repo: Parameters<typeof createProviderRepositoryWebhook>[0],
  webhook: { id: string; signingSecret: string }
) => {
  await removeManagedWebhooks(repo);
  let externalId = await createProviderRepositoryWebhook(repo, webhook);
  let state = await readProviderRepositoryWebhook(repo, { ...webhook, externalId });
  let desiredEvents = getDesiredRepositoryWebhookEvents(repo);
  let callbackUrl = getRepositoryWebhookCallbackUrl(repo.provider, webhook.id);
  if (
    !state.active ||
    state.callbackUrl !== callbackUrl ||
    !equalRepositoryWebhookEvents(state.registeredEvents, desiredEvents)
  ) {
    throw Object.assign(new Error('Provider did not register the requested webhook events'), {
      status: 422
    });
  }
  return state;
};

export let reconcileRepositoryWebhook = async (repoId: string) => {
  let repo = await db.scmRepository.findUnique({
    where: { id: repoId },
    include: { installation: { include: { backend: true } } }
  });
  if (!repo) return;
  if (
    repo.webhookReconcileBlockedUntil &&
    repo.webhookReconcileBlockedUntil.getTime() > Date.now()
  ) {
    return;
  }
  if (isLocalOrPrivateWebhookUrl(env.service.ORIGIN_SERVICE_PUBLIC_URL)) return;

  try {
    let webhook = await db.scmRepositoryWebhook.findUnique({
      where: { repoOid: repo.oid }
    });

    if (!webhook) {
      let localWebhook = {
        id: await ID.generateId('scmRepositoryWebhook'),
        signingSecret: generatePlainId(32)
      };
      let state = await createAndConfirmWebhook(repo, localWebhook);
      await db.scmRepositoryWebhook.create({
        data: {
          ...localWebhook,
          repoOid: repo.oid,
          externalId: state.externalId,
          registeredEvents: state.registeredEvents,
          type: 'push'
        }
      });
      await clearRepositoryWebhookReconcileBlock(repo);
      return;
    }

    let state;
    try {
      state = await readProviderRepositoryWebhook(repo, webhook);
    } catch (error) {
      if (getScmProviderErrorStatus(error) !== 404) throw error;
      state = await createAndConfirmWebhook(repo, webhook);
      await db.scmRepositoryWebhook.update({
        where: { oid: webhook.oid },
        data: {
          externalId: state.externalId,
          registeredEvents: state.registeredEvents
        }
      });
      await clearRepositoryWebhookReconcileBlock(repo);
      return;
    }

    let desiredEvents = getDesiredRepositoryWebhookEvents(repo);
    let callbackUrl = getRepositoryWebhookCallbackUrl(repo.provider, webhook.id);
    let providerMatches =
      state.active &&
      state.callbackUrl === callbackUrl &&
      equalRepositoryWebhookEvents(state.registeredEvents, desiredEvents);

    if (!providerMatches) {
      let updated: boolean;
      try {
        updated = await updateProviderRepositoryWebhook(repo, webhook);
      } catch (error) {
        if (getScmProviderErrorStatus(error) !== 404) throw error;
        updated = false;
      }
      if (!updated) {
        try {
          await deleteProviderRepositoryWebhook(repo, webhook.externalId);
        } catch (error) {
          if (getScmProviderErrorStatus(error) !== 404) throw error;
        }
        state = await createAndConfirmWebhook(repo, webhook);
      } else {
        state = await readProviderRepositoryWebhook(repo, webhook);
      }

      if (
        !state.active ||
        state.callbackUrl !== callbackUrl ||
        !equalRepositoryWebhookEvents(state.registeredEvents, desiredEvents)
      ) {
        throw Object.assign(new Error('Provider did not register the requested webhook events'), {
          status: 422
        });
      }
    }

    if (
      webhook.externalId !== state.externalId ||
      !equalRepositoryWebhookEvents(webhook.registeredEvents, state.registeredEvents)
    ) {
      await db.scmRepositoryWebhook.update({
        where: { oid: webhook.oid },
        data: {
          externalId: state.externalId,
          registeredEvents: state.registeredEvents
        }
      });
    }
    await clearRepositoryWebhookReconcileBlock(repo);
  } catch (error) {
    if (shouldBlockRepositoryWebhookReconcile(error)) {
      await blockRepositoryWebhookReconcile(repo.oid, error);
      return;
    }
    throw error;
  }
};

export let createRepoWebhookQueueProcessor = createRepoWebhookQueue.process(async data => {
  await reconcileRepositoryWebhook(data.repoId);
});
