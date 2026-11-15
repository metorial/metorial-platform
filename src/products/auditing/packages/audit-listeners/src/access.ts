import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let assignmentPayload = (event: {
  accessPolicy: { id: string; name: string; slug: string };
  accessPolicyAssignment: { id: string };
  team?: { id: string; name: string };
  member?: { id: string };
  serviceAccount?: { id: string };
}) => ({
  assignment: { id: event.accessPolicyAssignment.id },
  accessPolicy: {
    id: event.accessPolicy.id,
    name: event.accessPolicy.name,
    slug: event.accessPolicy.slug
  },
  team: event.team ? { id: event.team.id, name: event.team.name } : undefined,
  member: event.member ? { id: event.member.id } : undefined,
  serviceAccount: event.serviceAccount ? { id: event.serviceAccount.id } : undefined
});

export let recordAccessRoleCreated = async (
  event: FabricEvents['organization.access_role.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'access_role', 'create', {
      payload: {
        accessRole: event.accessRole
      },
      recordedAt
    });
  });
};

export let recordAccessRoleUpdated = async (
  event: FabricEvents['organization.access_role.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'access_role', 'update', {
      payload: {
        accessRole: event.accessRole
      },
      previousPayload: {
        accessRole: {
          ...event.previousAccessRole,
          organization: event.organization
        }
      },
      recordedAt
    });
  });
};

export let recordAccessRoleDeleted = async (
  event: FabricEvents['organization.access_role.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'access_role', 'delete', {
      payload: {
        accessRole: event.accessRole
      },
      recordedAt
    });
  });
};

export let recordAccessPolicyCreated = async (
  event: FabricEvents['organization.access_policy.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'access_policy', 'create', {
      payload: {
        accessPolicy: event.accessPolicy
      },
      recordedAt
    });
  });
};

export let recordAccessPolicyUpdated = async (
  event: FabricEvents['organization.access_policy.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'access_policy', 'update', {
      payload: {
        accessPolicy: event.accessPolicy
      },
      previousPayload: {
        accessPolicy: {
          ...event.previousAccessPolicy,
          organization: event.organization,
          accessPolicyRoles: [],
          accessPolicyProjects: [],
          accessPolicyInstances: []
        }
      },
      recordedAt
    });
  });
};

export let recordAccessPolicyDeleted = async (
  event: FabricEvents['organization.access_policy.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'access_policy', 'delete', {
      payload: {
        accessPolicy: event.accessPolicy
      },
      recordedAt
    });
  });
};

export let recordAccessPolicyAssignedToTeam = async (
  event: FabricEvents['organization.access_policy.assignment.team.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'access_policy_assignment',
      'create',
      {
        payload: assignmentPayload(event),
        recordedAt
      }
    );
  });
};

export let recordAccessPolicyUnassignedFromTeam = async (
  event: FabricEvents['organization.access_policy.assignment.team.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'access_policy_assignment',
      'delete',
      {
        payload: assignmentPayload(event),
        recordedAt
      }
    );
  });
};

export let recordAccessPolicyAssignedToMember = async (
  event: FabricEvents['organization.access_policy.assignment.member.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'access_policy_assignment',
      'create',
      {
        payload: assignmentPayload(event),
        recordedAt
      }
    );
  });
};

export let recordAccessPolicyUnassignedFromMember = async (
  event: FabricEvents['organization.access_policy.assignment.member.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'access_policy_assignment',
      'delete',
      {
        payload: assignmentPayload(event),
        recordedAt
      }
    );
  });
};

export let recordAccessPolicyAssignedToServiceAccount = async (
  event: FabricEvents['organization.access_policy.assignment.service_account.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'access_policy_assignment',
      'create',
      {
        payload: assignmentPayload(event),
        recordedAt
      }
    );
  });
};

export let recordAccessPolicyUnassignedFromServiceAccount = async (
  event: FabricEvents['organization.access_policy.assignment.service_account.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'access_policy_assignment',
      'delete',
      {
        payload: assignmentPayload(event),
        recordedAt
      }
    );
  });
};

Fabric.listen('organization.access_role.created:after', recordAccessRoleCreated);
Fabric.listen('organization.access_role.updated:after', recordAccessRoleUpdated);
Fabric.listen('organization.access_role.deleted:after', recordAccessRoleDeleted);
Fabric.listen('organization.access_policy.created:after', recordAccessPolicyCreated);
Fabric.listen('organization.access_policy.updated:after', recordAccessPolicyUpdated);
Fabric.listen('organization.access_policy.deleted:after', recordAccessPolicyDeleted);
Fabric.listen(
  'organization.access_policy.assignment.team.created:after',
  recordAccessPolicyAssignedToTeam
);
Fabric.listen(
  'organization.access_policy.assignment.team.deleted:after',
  recordAccessPolicyUnassignedFromTeam
);
Fabric.listen(
  'organization.access_policy.assignment.member.created:after',
  recordAccessPolicyAssignedToMember
);
Fabric.listen(
  'organization.access_policy.assignment.member.deleted:after',
  recordAccessPolicyUnassignedFromMember
);
Fabric.listen(
  'organization.access_policy.assignment.service_account.created:after',
  recordAccessPolicyAssignedToServiceAccount
);
Fabric.listen(
  'organization.access_policy.assignment.service_account.deleted:after',
  recordAccessPolicyUnassignedFromServiceAccount
);
