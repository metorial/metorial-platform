import { createQueue } from '@lowerdeck/queue';
import type { SlateWebhookRegistrationAuthRouting } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { getId, snowflake } from '../../id';
import { TRIGGER_POLL_MIN_INTERVAL_SECONDS } from './_config';
import { createTriggerRegistrationInstanceError } from './_instanceError';
import { triggerWebhookTargetSearchQueue } from './webhookTargetSearch';

export let triggerRegistrationInstanceSetupQueue = createQueue<{
  triggerRegistrationInstanceId: string;
}>({
  name: 'shub/trg/inst/setup',
  redisUrl: env.service.REDIS_URL
});

export let triggerRegistrationInstanceSetupQueueProcessor =
  triggerRegistrationInstanceSetupQueue.process(async data => {
    let instance = await db.triggerRegistrationInstance.findUnique({
      where: { id: data.triggerRegistrationInstanceId },
      include: { triggerGroup: true, triggerRegistration: true, schedule: true }
    });
    if (!instance || instance.schedule) return;

    let invocation = instance.triggerGroup.spec.invocation;

    if (invocation.type === 'polling') {
      let intervalSeconds = Math.max(
        invocation.intervalSeconds,
        TRIGGER_POLL_MIN_INTERVAL_SECONDS
      );

      await db.triggerRegistrationSchedule.create({
        data: {
          ...getId('triggerRegistrationSchedule'),
          triggerRegistrationInstanceOid: instance.oid,
          intervalSeconds,
          firstRunAt: null,
          lastRunAt: null,
          nextRunAt: new Date()
        }
      });

      return;
    }

    if (invocation.registration.mode === 'auto') {
      await triggerWebhookTargetSearchQueue.add(
        { triggerRegistrationInstanceId: instance.id, pageToken: null },
        { id: `${instance.id}:first` }
      );
    } else {
      await matchManualWebhookRegistration(instance);
    }
  });

let matchManualWebhookRegistration = async (instance: {
  oid: bigint;
  triggerGroup: { oid: bigint };
  triggerRegistration: { tenantOid: bigint; authConfigOid: bigint | null };
}) => {
  let registration = instance.triggerRegistration;

  let candidates = await db.slateWebhookRegistration.findMany({
    where: {
      triggerGroupOid: instance.triggerGroup.oid,
      status: 'active',
      OR: [{ owner: 'tenant', tenantOid: registration.tenantOid }, { owner: 'global' }]
    }
  });

  let hasAuthConfig = !!registration.authConfigOid;
  let findMatch = (pool: typeof candidates) => {
    let byRouting = (routing: SlateWebhookRegistrationAuthRouting) =>
      pool.find(c => c.authRouting === routing);
    return (
      (hasAuthConfig && byRouting('restricted_credential')) ||
      (hasAuthConfig && byRouting('restricted_method')) ||
      byRouting('any') ||
      null
    );
  };

  let match =
    findMatch(candidates.filter(c => c.owner === 'tenant')) ||
    findMatch(candidates.filter(c => c.owner === 'global'));

  if (!match) {
    await createTriggerRegistrationInstanceError({
      triggerRegistrationInstanceOid: instance.oid,
      code: 'no_matching_webhook_registration',
      message:
        'No existing webhook registration matches this provider instance yet - ask an admin to set one up.'
    });
    return;
  }

  try {
    await db.triggerRegistrationWebhook.create({
      data: {
        oid: snowflake.nextId(),
        triggerRegistrationInstanceOid: instance.oid,
        webhookRegistrationOid: match.oid
      }
    });
  } catch (err: any) {
    if (err.code !== 'P2002') throw err;
  }
};
