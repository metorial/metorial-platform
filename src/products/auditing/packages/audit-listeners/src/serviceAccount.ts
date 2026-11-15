import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

type AuditServiceAccount =
  FabricEvents['machine_access.service_account.created:after']['serviceAccount'];

let serviceAccountWithSubject = (
  serviceAccount: AuditServiceAccount,
  subject: Pick<AuditServiceAccount, 'portal' | 'consumerProfile'>
) => ({
  ...serviceAccount,
  portal: serviceAccount.portal ?? subject.portal ?? null,
  consumerProfile: serviceAccount.consumerProfile ?? subject.consumerProfile ?? null
});

export let recordServiceAccountCreated = async (
  event: FabricEvents['machine_access.service_account.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'service_account', 'create', {
      payload: {
        serviceAccount: serviceAccountWithSubject(event.serviceAccount, event)
      },
      recordedAt
    });
  });
};

export let recordServiceAccountUpdated = async (
  event: FabricEvents['machine_access.service_account.updated:after']
) => {
  let serviceAccount = serviceAccountWithSubject(event.serviceAccount, event);

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'service_account', 'update', {
      payload: {
        serviceAccount
      },
      previousPayload: {
        serviceAccount: serviceAccountWithSubject(event.previousServiceAccount, serviceAccount)
      },
      recordedAt
    });
  });
};

export let recordServiceAccountArchived = async (
  event: FabricEvents['machine_access.service_account.archived:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'service_account', 'archive', {
      payload: {
        serviceAccount: serviceAccountWithSubject(event.serviceAccount, event)
      },
      recordedAt
    });
  });
};

export let recordServiceAccountCredentialCreated = async (
  event: FabricEvents['machine_access.service_account_credential.created:after']
) => {
  if (!event.auditScope) return;

  let auditScope = event.auditScope;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(auditScope, 'service_account_credential', 'create', {
      payload: {
        id: event.serviceAccountCredential.id,
        serviceAccount: {
          id: event.serviceAccount.id,
          name: event.serviceAccount.name
        },
        oauthApplication: {
          id: event.oauthApplication.id,
          name: event.oauthApplication.name
        }
      },
      recordedAt
    });
  });
};

Fabric.listen('machine_access.service_account.created:after', recordServiceAccountCreated);
Fabric.listen('machine_access.service_account.updated:after', recordServiceAccountUpdated);
Fabric.listen('machine_access.service_account.archived:after', recordServiceAccountArchived);
Fabric.listen(
  'machine_access.service_account_credential.created:after',
  recordServiceAccountCredentialCreated
);
