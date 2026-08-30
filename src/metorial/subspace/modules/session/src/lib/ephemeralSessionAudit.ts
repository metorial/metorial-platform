import { getSubspaceSystemAuditScope } from '@metorial-subspace/module-tenant/src/lib/systemAuditScope';
import { Fabric, type AuditSubspaceSession } from '@metorial/fabric';

export let recordEphemeralSessionAuditEvent = async (d: {
  session: AuditSubspaceSession;
  instanceOid: bigint | null;
  projectOid: bigint | null;
}) => {
  try {
    let auditScope = await getSubspaceSystemAuditScope({
      job: 'subspace/ephemeralManagedSession',
      instanceOid: d.instanceOid,
      projectOid: d.projectOid,
      metadata: { sessionId: d.session.id }
    });
    if (!auditScope) return;

    await Fabric.fire('provider.session.ephemeral_created:after', {
      auditScope,
      session: d.session
    });
  } catch (error) {
    console.error('[Audit] Failed to record ephemeral managed session audit event', error);
  }
};
