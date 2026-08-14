import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let invitePayload = (
  invite:
    | FabricEvents['organization.invitation.created:after']['invite']
    | FabricEvents['organization.invitation.updated:after']['previousInvite'],
  organization: FabricEvents['organization.invitation.created:after']['organization']
) => ({
  organizationInvite: {
    ...invite,
    organization
  } as FabricEvents['organization.invitation.created:after']['invite']
});

export let recordOrganizationInviteCreated = async (
  event: FabricEvents['organization.invitation.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'organization_invite', 'create', {
      payload: invitePayload(event.invite, event.organization),
      recordedAt
    });
  });
};

export let recordOrganizationInviteUpdated = async (
  event: FabricEvents['organization.invitation.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'organization_invite', 'update', {
      payload: invitePayload(event.invite, event.organization),
      previousPayload: invitePayload(event.previousInvite, event.organization),
      recordedAt
    });
  });
};

export let recordOrganizationInviteDeleted = async (
  event: FabricEvents['organization.invitation.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'organization_invite', 'delete', {
      payload: invitePayload(event.invite, event.organization),
      recordedAt
    });
  });
};

export let recordOrganizationInviteAccepted = async (
  event: FabricEvents['organization.invitation.accepted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'organization_invite', 'accept', {
      payload: invitePayload(event.invite, event.organization),
      previousPayload: invitePayload(event.previousInvite, event.organization),
      recordedAt
    });
  });
};

export let recordOrganizationInviteRejected = async (
  event: FabricEvents['organization.invitation.rejected:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'organization_invite', 'reject', {
      payload: invitePayload(event.invite, event.organization),
      previousPayload: invitePayload(event.previousInvite, event.organization),
      recordedAt
    });
  });
};

Fabric.listen('organization.invitation.created:after', recordOrganizationInviteCreated);
Fabric.listen('organization.invitation.updated:after', recordOrganizationInviteUpdated);
Fabric.listen('organization.invitation.deleted:after', recordOrganizationInviteDeleted);
Fabric.listen('organization.invitation.accepted:after', recordOrganizationInviteAccepted);
Fabric.listen('organization.invitation.rejected:after', recordOrganizationInviteRejected);
