import type { AuditScope } from '@metorial/audit-scope';
import type { ProviderEventBase } from '@metorial/fabric';

export let recordSubspaceAuditEvent = async (record: () => Promise<void>) => {
  try {
    await record();
  } catch (error) {
    console.error('[Audit] Failed to record subspace audit event', error);
  }
};

export let getSubspaceAuditScope = (event: ProviderEventBase): AuditScope | null => {
  if (!event.auditScope) return null;

  if (event.auditScope.instanceOid === undefined) {
    return { ...event.auditScope, instanceOid: event.instance.oid };
  }

  return event.auditScope;
};
