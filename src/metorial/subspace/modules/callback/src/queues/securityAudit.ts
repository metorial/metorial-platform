import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../env';
import { callbackSecurityAuditService } from '../services/callbackSecurityAudit';
import {
  getCallbackReceiverSecretAuthority,
  type CallbackSecretAuditContext
} from '../services/callbackReceiverSecret';

export type CallbackSecurityAuditRepairInput = {
  tenantId: string;
  hubTenantId: string;
  callbackId: string;
  callbackInstanceId: string;
  receiverId: string;
  receiverAuthorityVersion: number;
  auditCorrelationId: string;
  auditContext: CallbackSecretAuditContext;
};

export let securityAuditQueue = createQueue<CallbackSecurityAuditRepairInput>({
  name: 'sub/callback/security-audit/repair',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

export let enqueueCallbackSecurityAuditRepair = async (
  input: CallbackSecurityAuditRepairInput
) =>
  await securityAuditQueue.add(input, {
    id: `callback-security-audit:${input.auditCorrelationId}`
  });

export let repairCallbackSecurityAudit = async (input: CallbackSecurityAuditRepairInput) => {
  let existing = await callbackSecurityAuditService.getByCorrelation(input.auditCorrelationId);
  if (existing) return existing;

  let hubAudit =
    await getCallbackReceiverSecretAuthority().getReceiverSecretAuditByCorrelation({
      tenantId: input.hubTenantId,
      receiverId: input.receiverId,
      callbackId: input.callbackId,
      callbackInstanceId: input.callbackInstanceId,
      receiverAuthorityVersion: input.receiverAuthorityVersion,
      ...input.auditContext,
      auditCorrelationId: input.auditCorrelationId
    });
  let tenant = await db.tenant.findUnique({ where: { id: input.tenantId } });
  let callback = tenant
    ? await db.callback.findFirst({
        where: { id: input.callbackId, tenantOid: tenant.oid }
      })
    : null;
  let callbackInstance = callback
    ? await db.callbackInstance.findFirst({
        where: { id: input.callbackInstanceId, callbackOid: callback.oid }
      })
    : null;
  return await callbackSecurityAuditService.appendLinked({
    tenant: tenant ?? undefined,
    callback: callback ?? undefined,
    callbackInstance: callbackInstance ?? undefined,
    ownerSnapshot: {
      tenantId: input.tenantId,
      callbackId: input.callbackId,
      callbackInstanceId: input.callbackInstanceId,
      receiverId: input.receiverId,
      receiverAuthorityVersion: input.receiverAuthorityVersion
    },
    expectedHubTenantId: input.hubTenantId,
    hubAudit,
    expectedContext: input.auditContext
  });
};

export let securityAuditQueueProcessor = securityAuditQueue.process(async input => {
  await repairCallbackSecurityAudit(input);
});
