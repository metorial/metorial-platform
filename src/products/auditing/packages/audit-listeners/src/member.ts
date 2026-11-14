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
          // `previousMember` only carries the member's own columns, so the relations the
          // presenter needs are taken from the updated member. An update cannot change them.
          organization: event.organization,
          actor: event.member.actor,
          user: event.member.user,
          policies: event.member.policies
        }
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
