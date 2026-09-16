import { canonicalize } from '@lowerdeck/canonicalize';
import { createQueue } from '@lowerdeck/queue';
import type { Prisma, TriggerWebhookTarget } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { getId, snowflake } from '../../id';
import { TRIGGER_WEBHOOK_FAILED_RETRY_COOLDOWN_MS } from './_config';
import { webhookTargetLock } from './_webhookTargetLock';
import { triggerRegistrationCleanupQueue } from './registrationCleanup';
import { triggerWebhookRegisterQueue } from './webhookRegister';

type DiscoveredTarget = {
  webhookTargetIdentifier: string;
  name: string;
  description?: string | null;
  metadata: Record<string, any>;
  webhookTargetPayload: any;
  targetOwnership: 'single_user' | 'multi_user';
};

export let triggerWebhookTargetLinkQueue = createQueue<{
  triggerRegistrationInstanceId: string;
  target: DiscoveredTarget;
  discoveredAt?: Date;
}>({
  name: 'shub/trg/whk/link/1',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { removeOnFail: true }
});

export let triggerWebhookTargetLinkQueueProcessor = triggerWebhookTargetLinkQueue.process(
  async data => {
    let instance = await db.triggerRegistrationInstance.findUnique({
      where: { id: data.triggerRegistrationInstanceId },
      include: { triggerGroup: true, triggerRegistration: true }
    });
    if (!instance || instance.triggerRegistration.status !== 'active') return;

    let target = data.target;
    let normalizedTargetIdentifier =
      target.targetOwnership === 'single_user'
        ? `${instance.id}:${target.webhookTargetIdentifier}`
        : target.webhookTargetIdentifier;

    let webhookTarget: TriggerWebhookTarget;
    try {
      webhookTarget = await db.triggerWebhookTarget.create({
        data: {
          ...getId('triggerWebhookTarget'),
          status: 'creating',
          tenantOid: instance.triggerRegistration.tenantOid,
          triggerGroupOid: instance.triggerGroup.oid,
          targetIdentifier: target.webhookTargetIdentifier,
          normalizedTargetIdentifier,
          name: target.name,
          description: target.description,
          metadata: target.metadata,
          webhookTargetPayload: target.webhookTargetPayload
        }
      });
    } catch (err: any) {
      if (err.code !== 'P2002') throw err;
      webhookTarget = await db.triggerWebhookTarget.findFirstOrThrow({
        where: {
          tenantOid: instance.triggerRegistration.tenantOid,
          triggerGroupOid: instance.triggerGroup.oid,
          normalizedTargetIdentifier
        }
      });
    }

    let linkWhere = {
      triggerRegistrationInstanceOid_triggerWebhookTargetOid: {
        triggerRegistrationInstanceOid: instance.oid,
        triggerWebhookTargetOid: webhookTarget.oid
      }
    };
    // Providers may rename targets; keep the stored identity in sync for every status.
    let identity = {
      name: target.name,
      description: target.description ?? null,
      metadata: target.metadata,
      webhookTargetPayload: target.webhookTargetPayload
    };
    // Postgres jsonb does not preserve key order, so stored and discovered JSON must be compared
    // canonically or every rediscovery would look like a change.
    let hasIdentityChanged = (stored: TriggerWebhookTarget) =>
      identity.name !== stored.name ||
      identity.description !== stored.description ||
      canonicalize(identity.metadata) !== canonicalize(stored.metadata) ||
      canonicalize(identity.webhookTargetPayload) !==
        canonicalize(stored.webhookTargetPayload);

    // Steady state on every rediscovery: nothing to change, and the search job already
    // refreshed lastDiscoveredAt. Skip the lock so provider calls holding it are not contended.
    let existingLink = await db.triggerRegistrationWebhook.findUnique({ where: linkWhere });
    if (
      webhookTarget.status === 'active' &&
      existingLink &&
      existingLink.webhookRegistrationOid === webhookTarget.webhookRegistrationOid &&
      !hasIdentityChanged(webhookTarget)
    ) {
      return;
    }

    await webhookTargetLock.usingLock(webhookTarget.id, async () => {
      webhookTarget = await db.triggerWebhookTarget.findUniqueOrThrow({
        where: { oid: webhookTarget.oid }
      });
      let registration = await db.triggerRegistration.findUnique({
        where: { oid: instance.triggerRegistrationOid }
      });
      if (!registration || registration.status !== 'active') return;

      let existingLink = await db.triggerRegistrationWebhook.findUnique({ where: linkWhere });
      let identityChanged = hasIdentityChanged(webhookTarget);

      // A failed target is retried only when there is a reason to expect a different
      // outcome: the target changed, a new connection (new credentials) linked it, or the
      // cool-down passed. Otherwise every rediscovery would fail again and spam errors.
      let retryFailed =
        webhookTarget.status === 'failed' &&
        (identityChanged ||
          !existingLink ||
          webhookTarget.updatedAt.getTime() <
            Date.now() - TRIGGER_WEBHOOK_FAILED_RETRY_COOLDOWN_MS);

      let update: Prisma.TriggerWebhookTargetUncheckedUpdateInput = identityChanged
        ? { ...identity }
        : {};
      if (webhookTarget.status === 'deleted' || retryFailed) {
        update.status = 'creating';
        update.webhookRegistrationOid = null;
        update.unregistrationStarted = false;
      } else if (webhookTarget.status === 'deleting' && !webhookTarget.unregistrationStarted) {
        update.status = webhookTarget.webhookRegistrationOid ? 'active' : 'creating';
      }
      if (Object.keys(update).length > 0) {
        webhookTarget = await db.triggerWebhookTarget.update({
          where: { oid: webhookTarget.oid },
          data: update
        });
      }

      let discoveredAt = data.discoveredAt ?? new Date();
      let lastDiscoveredAt =
        existingLink?.lastDiscoveredAt && existingLink.lastDiscoveredAt > discoveredAt
          ? existingLink.lastDiscoveredAt
          : discoveredAt;
      await db.triggerRegistrationWebhook.upsert({
        where: linkWhere,
        create: {
          oid: snowflake.nextId(),
          triggerRegistrationInstanceOid: instance.oid,
          triggerWebhookTargetOid: webhookTarget.oid,
          webhookRegistrationOid: webhookTarget.webhookRegistrationOid,
          lastDiscoveredAt
        },
        update: {
          webhookRegistrationOid: webhookTarget.webhookRegistrationOid,
          lastDiscoveredAt
        }
      });
      registration = await db.triggerRegistration.findUnique({
        where: { oid: instance.triggerRegistrationOid }
      });
      if (!registration || registration.status !== 'active') {
        await triggerRegistrationCleanupQueue.add(
          { triggerRegistrationId: instance.triggerRegistration.id },
          { id: instance.triggerRegistration.id }
        );
        return;
      }
      if (webhookTarget.status === 'creating') {
        await triggerWebhookRegisterQueue.add(
          {
            triggerWebhookTargetId: webhookTarget.id,
            triggerRegistrationInstanceId: instance.id
          },
          { id: `${webhookTarget.id}:${instance.id}` }
        );
      }
    });
  }
);
