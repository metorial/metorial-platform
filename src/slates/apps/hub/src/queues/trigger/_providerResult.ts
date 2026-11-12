import type { Tenant } from '../../../prisma/generated/client';
import { db } from '../../db';
import { secretService } from '../../services/secret';
import { webhookLeaseDates } from './_lease';

// Saved before the fenced commit: retries adopt it, and a result nobody adopts is rolled
// back by the renewal cleanup queue.
export let saveWebhookProviderResult = async (d: {
  tenant: Tenant;
  operationId: string;
  targetOid: bigint;
  instanceOid: bigint;
  invocationOid: bigint;
  oldRegistrationIdentifier: string;
  registrationIdentifier: string;
  payload: unknown;
  lease: { expiresAt?: string | null; renewAfter?: string | null };
  delivery?: { bindingId: string; routingKeys: string[] };
}) => {
  let lease = webhookLeaseDates(d.lease);
  let secret = await secretService.createSecret({
    tenant: d.tenant,
    purpose: 'slate_webhook_registration_payload',
    secretData: { payload: d.payload }
  });

  let saved = await db.triggerWebhookRenewalResult.upsert({
    where: { operationId: d.operationId },
    create: {
      operationId: d.operationId,
      targetOid: d.targetOid,
      instanceOid: d.instanceOid,
      invocationOid: d.invocationOid,
      secretOid: secret.oid,
      oldRegistrationIdentifier: d.oldRegistrationIdentifier,
      registrationIdentifier: d.registrationIdentifier,
      expiresAt: lease.expiresAt,
      renewAfter: lease.renewAfter,
      nextRenewalAt: lease.nextAttemptAt,
      deliveryBindingId: d.delivery?.bindingId ?? null,
      routingKeys: d.delivery?.routingKeys ?? []
    },
    update: {}
  });
  if (saved.secretOid !== secret.oid)
    await secretService.DANGEROUSLY_deleteSecret({ tenant: d.tenant, secretOid: secret.oid });

  return saved;
};
