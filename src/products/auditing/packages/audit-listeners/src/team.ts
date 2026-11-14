import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let teamMemberPayload = (
  event:
    | FabricEvents['organization.team.member.added:after']
    | FabricEvents['organization.team.member.removed:after']
) => ({
  team: {
    id: event.team.id,
    name: event.team.name,
    slug: event.team.slug
  },
  actor: {
    id: event.actor.id,
    name: event.actor.name,
    email: event.actor.email
  },
  member: {
    id: event.member.id
  }
});

export let recordTeamCreated = async (
  event: FabricEvents['organization.team.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'team', 'create', {
      payload: {
        team: event.team
      },
      recordedAt
    });
  });
};

export let recordTeamUpdated = async (
  event: FabricEvents['organization.team.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'team', 'update', {
      payload: {
        team: event.team
      },
      previousPayload: {
        team: {
          ...event.previousTeam,
          organization: event.organization,
          projects: []
        }
      },
      recordedAt
    });
  });
};

export let recordTeamDeleted = async (
  event: FabricEvents['organization.team.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'team', 'delete', {
      payload: {
        team: event.team
      },
      recordedAt
    });
  });
};

export let recordTeamMemberAdded = async (
  event: FabricEvents['organization.team.member.added:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'team_member', 'create', {
      payload: teamMemberPayload(event),
      recordedAt
    });
  });
};

export let recordTeamMemberRemoved = async (
  event: FabricEvents['organization.team.member.removed:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'team_member', 'delete', {
      payload: teamMemberPayload(event),
      recordedAt
    });
  });
};

Fabric.listen('organization.team.created:after', recordTeamCreated);
Fabric.listen('organization.team.updated:after', recordTeamUpdated);
Fabric.listen('organization.team.deleted:after', recordTeamDeleted);
Fabric.listen('organization.team.member.added:after', recordTeamMemberAdded);
Fabric.listen('organization.team.member.removed:after', recordTeamMemberRemoved);
