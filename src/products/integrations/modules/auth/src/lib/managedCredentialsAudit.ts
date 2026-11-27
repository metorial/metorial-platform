import { getSubspaceSystemAuditScope } from '@metorial-subspace/module-tenant/src/lib/systemAuditScope';
import { Fabric, type AuditSubspaceProviderAuthCredentials } from '@metorial/fabric';

export let recordManagedCredentialsAuditEvent = async (d: {
  action: 'create' | 'update';
  authCredentials: AuditSubspaceProviderAuthCredentials;
  previousAuthCredentials?: AuditSubspaceProviderAuthCredentials;
  projectOid: bigint | null;
}) => {
  try {
    let auditScope = await getSubspaceSystemAuditScope({
      job: 'subspace/managedProviderAuthCredentials',
      projectOid: d.projectOid,
      metadata: { providerAuthCredentialsId: d.authCredentials.id }
    });
    if (!auditScope) return;

    if (d.action === 'create') {
      await Fabric.fire('provider.auth_credentials.managed_created:after', {
        auditScope,
        authCredentials: d.authCredentials
      });
      return;
    }

    if (!d.previousAuthCredentials) return;

    await Fabric.fire('provider.auth_credentials.managed_updated:after', {
      auditScope,
      authCredentials: d.authCredentials,
      previousAuthCredentials: d.previousAuthCredentials
    });
  } catch (error) {
    console.error('[Audit] Failed to record managed credentials audit event', error);
  }
};
