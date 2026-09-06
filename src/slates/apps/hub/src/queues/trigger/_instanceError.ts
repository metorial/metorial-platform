import { db } from '../../db';
import { getId } from '../../id';

// Shared by the webhook discovery/link/register queues and the manual-matching branch of
// setup.ts - guards against writing duplicate error rows for the same (instance, target,
// code) if a job retries or re-runs.
export let createTriggerRegistrationInstanceError = async (d: {
  triggerRegistrationInstanceOid: bigint;
  triggerWebhookTargetOid?: bigint;
  registrationAttemptOid?: bigint;
  code: string;
  message: string;
}) => {
  let existing = await db.triggerRegistrationInstanceError.findFirst({
    where: {
      triggerRegistrationInstanceOid: d.triggerRegistrationInstanceOid,
      triggerWebhookTargetOid: d.triggerWebhookTargetOid ?? null,
      code: d.code
    }
  });
  if (existing) return existing;

  return db.triggerRegistrationInstanceError.create({
    data: {
      ...getId('triggerRegistrationInstanceError'),
      triggerRegistrationInstanceOid: d.triggerRegistrationInstanceOid,
      triggerWebhookTargetOid: d.triggerWebhookTargetOid,
      registrationAttemptOid: d.registrationAttemptOid,
      code: d.code,
      message: d.message
    }
  });
};
