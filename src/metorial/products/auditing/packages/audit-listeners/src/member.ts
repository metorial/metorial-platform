import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

export let recordOrganizationMemberCreated = async (
  event: FabricEvents['organization.member.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'organization_member', 'create', {
      payload: {
        organizationMember: event.member
      },
      recordedAt
    });
  });
};

export let recordOrganizationMemberUpdated = async (
  event: FabricEvents['organization.member.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'organization_member', 'update', {
      payload: {
        organizationMember: event.member
      },
      previousPayload: {
        organizationMember: {
          ...event.previousMember,
          organization: event.organization
        } as FabricEvents['organization.member.updated:after']['member']
      },
      recordedAt
    });
  });
};

export let recordOrganizationMemberDeleted = async (
  event: FabricEvents['organization.member.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'organization_member', 'delete', {
      payload: {
        organizationMember: event.member
      },
      recordedAt
    });
  });
};

Fabric.listen('organization.member.created:after', recordOrganizationMemberCreated);
Fabric.listen('organization.member.updated:after', recordOrganizationMemberUpdated);
Fabric.listen('organization.member.deleted:after', recordOrganizationMemberDeleted);
