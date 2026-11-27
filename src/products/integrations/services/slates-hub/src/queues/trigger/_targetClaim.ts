import { QueueRetryError } from '@lowerdeck/queue';
import type { Prisma } from '../../../prisma/generated/client';
import { db } from '../../db';
import { snowflake } from '../../id';
import { triggerStateLeaseMs } from './_state';

// Function Bay caps invocations at 900 s; the margin absorbs clock skew and check-to-call delay.
let TRIGGER_PROVIDER_CALL_BUDGET_MS = 20 * 60 * 1000;

// Null when another worker holds an unexpired claim or the target no longer matches `where`.
export let claimWebhookTarget = async (d: {
  targetOid: bigint;
  where?: Prisma.TriggerWebhookTargetWhereInput;
  data?: Prisma.TriggerWebhookTargetUpdateManyMutationInput;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let token = snowflake.nextId().toString();
  let claimed = await db.triggerWebhookTarget.updateMany({
    where: {
      ...d.where,
      oid: d.targetOid,
      OR: [{ renewalClaimUntil: null }, { renewalClaimUntil: { lte: now } }]
    },
    data: {
      ...d.data,
      renewalClaimToken: token,
      renewalClaimUntil: new Date(now.getTime() + triggerStateLeaseMs)
    }
  });
  return claimed.count ? token : null;
};

export let releaseWebhookTarget = (
  targetOid: bigint,
  token: string,
  data?: Prisma.TriggerWebhookTargetUpdateManyMutationInput
) =>
  db.triggerWebhookTarget.updateMany({
    where: { oid: targetOid, renewalClaimToken: token },
    data: { ...data, renewalClaimToken: null, renewalClaimUntil: null }
  });

// Only a write made while the claim is still held may change the target.
export let fencedTargetWhere = (token: string) => ({
  renewalClaimToken: token,
  renewalClaimUntil: { gt: new Date() }
});

// An expired claim proves no earlier call is still running, so a call starts only if the claim outlasts it.
export let assertClaimCoversProviderCall = async (targetOid: bigint, claimToken: string) => {
  let held = await db.triggerWebhookTarget.count({
    where: {
      oid: targetOid,
      renewalClaimToken: claimToken,
      renewalClaimUntil: { gt: new Date(Date.now() + TRIGGER_PROVIDER_CALL_BUDGET_MS) }
    }
  });

  if (!held) throw new QueueRetryError();
};
