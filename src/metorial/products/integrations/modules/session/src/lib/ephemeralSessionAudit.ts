import { getSubspaceSystemAuditScope } from '@metorial-subspace/module-tenant/src/lib/systemAuditScope';
import { Fabric, type AuditSubspaceSession } from '@metorial/fabric';

export let recordEphemeralSessionAuditEvent = async (d: {
  session: AuditSubspaceSession;
  instanceOid: bigint | null;
  projectOid: bigint | null;
}) => {
  let auditScope = await getSubspaceSystemAuditScope({
    job: 'subspace/ephemeralManagedSession',
    instanceOid: d.instanceOid,
    projectOid: d.projectOid,
    metadata: { sessionId: d.session.id }
  });
  if (!auditScope || d.instanceOid == null) return;

  await Fabric.fire('provider.session.ephemeral_created:after', {
    instanceOid: d.instanceOid,
    auditScope,
    session: d.session
  });
};
