import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let outpostCredentialPayload = (
  credential: { id: string; status: string; identifier: string; expiresAt: Date | null },
  outpostId: string
) => ({
  id: credential.id,
  status: credential.status,
  outpostId,
  name: credential.identifier,
  expiresAt: credential.expiresAt
});

export let recordOutpostCredentialCreated = async (
  event: FabricEvents['outpost_credential.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'outpost_credential', 'create', {
      payload: outpostCredentialPayload(event.credential, event.outpost.id),
      recordedAt
    });
  });
};

export let recordOutpostCredentialDisabled = async (
  event: FabricEvents['outpost_credential.disabled:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'outpost_credential', 'disable', {
      payload: outpostCredentialPayload(event.credential, event.outpost.id),
      previousPayload: outpostCredentialPayload(event.previousCredential, event.outpost.id),
      recordedAt
    });
  });
};

export let recordOutpostCredentialDeleted = async (
  event: FabricEvents['outpost_credential.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'outpost_credential', 'delete', {
      payload: outpostCredentialPayload(event.credential, event.outpost.id),
      previousPayload: outpostCredentialPayload(event.previousCredential, event.outpost.id),
      recordedAt
    });
  });
};

export let recordOutpostCredentialExpired = async (
  event: FabricEvents['outpost_credential.expired:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'outpost_credential', 'expire', {
      payload: outpostCredentialPayload(event.credential, event.outpost.id),
      previousPayload: outpostCredentialPayload(event.previousCredential, event.outpost.id),
      recordedAt
    });
  });
};

Fabric.listen('outpost_credential.created:after', recordOutpostCredentialCreated);
Fabric.listen('outpost_credential.disabled:after', recordOutpostCredentialDisabled);
Fabric.listen('outpost_credential.deleted:after', recordOutpostCredentialDeleted);
Fabric.listen('outpost_credential.expired:after', recordOutpostCredentialExpired);
