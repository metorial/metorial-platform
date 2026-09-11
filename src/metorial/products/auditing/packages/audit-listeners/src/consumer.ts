import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';
import { auditedEmailWhitelistLimit, consumerProfilePayload } from './workforce';

let consumerIdentityPayload = (
  instanceConsumer: FabricEvents['consumer.identity.created:after']['instanceConsumer']
) => ({
  id: instanceConsumer.id,
  consumerId: instanceConsumer.consumer.id,
  name: instanceConsumer.name,
  email: instanceConsumer.email,
  isOrganizationMember: instanceConsumer.consumer.isOrganizationMember,
  isPortalConsumer: instanceConsumer.consumer.isPortalConsumer,
  isManuallyCreated: instanceConsumer.consumer.isManuallyCreated,
  isPending: instanceConsumer.isPending,
  organizationMemberId: instanceConsumer.consumer.organizationMember?.id ?? null,
  userId: instanceConsumer.consumer.user?.id ?? null
});

let consumerGroupPayload = (
  consumerSurface: { id: string },
  consumerGroup: FabricEvents['consumer.group.created:after']['consumerGroup']
) => ({
  id: consumerGroup.id,
  status: consumerGroup.status,
  type: consumerGroup.type,
  name: consumerGroup.name,
  description: consumerGroup.description,
  isDefault: consumerGroup.isDefault,
  isDefaultEveryoneGroup: consumerGroup.isDefaultEveryoneGroup,
  isManaged: consumerGroup.isManaged,
  ssoGroupIds: consumerGroup.ssoGroupIds,
  surfaceId: consumerSurface.id
});

let consumerInvitePayload = (
  event:
    | FabricEvents['consumer.invite.created:after']
    | FabricEvents['consumer.invite.updated:after']
    | FabricEvents['consumer.invite.deleted:after']
) => ({
  id: event.consumerInvite.id,
  status: event.consumerInvite.status,
  email: event.consumerProfile.email,
  surfaceId: event.consumerSurface.id,
  consumerProfileId: event.consumerProfile.id,
  invitedByActorId: 'performedBy' in event ? event.performedBy.id : null,
  expiresAt: event.consumerInvite.expiresAt,
  acceptedAt: event.consumerInvite.acceptedAt
});

let consumerSurfaceRecordPayload = (
  consumerSurface: FabricEvents['consumer.surface.created:after']['consumerSurface']
) => {
  let emailWhitelist = consumerSurface.emailWhitelist.slice(0, auditedEmailWhitelistLimit);

  return {
    id: consumerSurface.id,
    status: consumerSurface.status,
    type: consumerSurface.type,
    name: consumerSurface.name,
    description: consumerSurface.description,
    isInternal: consumerSurface.isInternal,
    sessionExpiryTimeInSeconds: consumerSurface.sessionExpiryTimeInSeconds,
    allowConsumerSkillAuthoring: consumerSurface.allowConsumerSkillAuthoring,
    allowConsumerSkillPublishing: consumerSurface.allowConsumerSkillPublishing,
    emailWhitelist,
    emailWhitelistCount: consumerSurface.emailWhitelist.length,
    emailWhitelistTruncated: consumerSurface.emailWhitelist.length > emailWhitelist.length
  };
};

let consumerSessionPayload = (
  event:
    | FabricEvents['consumer.session.created:after']
    | FabricEvents['consumer.session.revoked:after']
) => ({
  id: event.consumerSession.id,
  consumerProfileId: event.consumerSession.consumerProfile.id,
  consumerProfileEmail: event.consumerSession.consumerProfile.email,
  surfaceId: event.consumerSession.consumerProfile.surface.id,
  portalId: event.consumerSession.consumerProfile.surface.portal?.id ?? null,
  ip: event.consumerSession.ip,
  ua: event.consumerSession.ua,
  expiresAt: event.consumerSession.expiresAt,
  loggedOutAt: event.consumerSession.loggedOutAt
});

let profileGroupPayload = (
  event:
    | FabricEvents['consumer.profile.group.added:after']
    | FabricEvents['consumer.profile.group.removed:after']
) => ({
  profile: {
    id: event.consumerProfile.id,
    email: event.consumerProfile.email
  },
  group: {
    id: event.consumerGroup.id,
    name: event.consumerGroup.name,
    isDefault: event.consumerGroup.isDefault
  },
  assignedVia: event.consumerProfileGroup.assignedVia
});

export let recordConsumerIdentityCreated = async (
  event: FabricEvents['consumer.identity.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer', 'create', {
      payload: consumerIdentityPayload(event.instanceConsumer),
      recordedAt
    });
  });
};

export let recordConsumerIdentityUpdated = async (
  event: FabricEvents['consumer.identity.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer', 'update', {
      payload: consumerIdentityPayload(event.instanceConsumer),
      previousPayload: consumerIdentityPayload(event.previousInstanceConsumer),
      recordedAt
    });
  });
};

export let recordConsumerProfileCreated = async (
  event: FabricEvents['consumer.profile.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_profile', 'create', {
      payload: consumerProfilePayload(event.consumerProfile),
      recordedAt
    });
  });
};

export let recordConsumerProfileUpdated = async (
  event: FabricEvents['consumer.profile.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_profile', 'update', {
      payload: consumerProfilePayload(event.consumerProfile),
      previousPayload: consumerProfilePayload(event.previousConsumerProfile),
      recordedAt
    });
  });
};

export let recordConsumerProfileDeleted = async (
  event: FabricEvents['consumer.profile.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_profile', 'delete', {
      payload: consumerProfilePayload(event.consumerProfile),
      recordedAt
    });
  });
};

export let recordConsumerProfileGroupAdded = async (
  event: FabricEvents['consumer.profile.group.added:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'consumer_profile_group',
      'create',
      { payload: profileGroupPayload(event), recordedAt }
    );
  });
};

export let recordConsumerProfileGroupRemoved = async (
  event: FabricEvents['consumer.profile.group.removed:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'consumer_profile_group',
      'delete',
      { payload: profileGroupPayload(event), recordedAt }
    );
  });
};

export let recordConsumerGroupCreated = async (
  event: FabricEvents['consumer.group.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_group', 'create', {
      payload: consumerGroupPayload(event.consumerSurface, event.consumerGroup),
      recordedAt
    });
  });
};

export let recordConsumerGroupUpdated = async (
  event: FabricEvents['consumer.group.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_group', 'update', {
      payload: consumerGroupPayload(event.consumerSurface, event.consumerGroup),
      previousPayload: consumerGroupPayload(
        event.consumerSurface,
        event.previousConsumerGroup
      ),
      recordedAt
    });
  });
};

export let recordConsumerGroupArchived = async (
  event: FabricEvents['consumer.group.archived:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_group', 'delete', {
      payload: consumerGroupPayload(event.consumerSurface, event.consumerGroup),
      recordedAt
    });
  });
};

export let recordConsumerInviteCreated = async (
  event: FabricEvents['consumer.invite.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_invite', 'create', {
      payload: consumerInvitePayload(event),
      recordedAt
    });
  });
};

export let recordConsumerInviteUpdated = async (
  event: FabricEvents['consumer.invite.updated:after']
) => {
  if (!event.auditScope) return;
  let auditScope = event.auditScope;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(auditScope, 'consumer_invite', 'update', {
      payload: consumerInvitePayload(event),
      recordedAt
    });
  });
};

export let recordConsumerInviteDeleted = async (
  event: FabricEvents['consumer.invite.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_invite', 'delete', {
      payload: consumerInvitePayload(event),
      recordedAt
    });
  });
};

export let recordConsumerSurfaceCreated = async (
  event: FabricEvents['consumer.surface.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_surface', 'create', {
      payload: consumerSurfaceRecordPayload(event.consumerSurface),
      recordedAt
    });
  });
};

export let recordConsumerSurfaceUpdated = async (
  event: FabricEvents['consumer.surface.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_surface', 'update', {
      payload: consumerSurfaceRecordPayload(event.consumerSurface),
      previousPayload: consumerSurfaceRecordPayload(event.previousConsumerSurface),
      recordedAt
    });
  });
};

export let recordConsumerSurfaceArchived = async (
  event: FabricEvents['consumer.surface.archived:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_surface', 'delete', {
      payload: consumerSurfaceRecordPayload(event.consumerSurface),
      recordedAt
    });
  });
};

export let recordConsumerSessionCreated = async (
  event: FabricEvents['consumer.session.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_session', 'create', {
      payload: consumerSessionPayload(event),
      recordedAt
    });
  });
};

export let recordConsumerSessionRevoked = async (
  event: FabricEvents['consumer.session.revoked:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_session', 'delete', {
      payload: consumerSessionPayload(event),
      recordedAt
    });
  });
};

Fabric.listen('consumer.identity.created:after', recordConsumerIdentityCreated);
Fabric.listen('consumer.identity.updated:after', recordConsumerIdentityUpdated);
Fabric.listen('consumer.profile.created:after', recordConsumerProfileCreated);
Fabric.listen('consumer.profile.updated:after', recordConsumerProfileUpdated);
Fabric.listen('consumer.profile.deleted:after', recordConsumerProfileDeleted);
Fabric.listen('consumer.profile.group.added:after', recordConsumerProfileGroupAdded);
Fabric.listen('consumer.profile.group.removed:after', recordConsumerProfileGroupRemoved);
Fabric.listen('consumer.group.created:after', recordConsumerGroupCreated);
Fabric.listen('consumer.group.updated:after', recordConsumerGroupUpdated);
Fabric.listen('consumer.group.archived:after', recordConsumerGroupArchived);
Fabric.listen('consumer.invite.created:after', recordConsumerInviteCreated);
Fabric.listen('consumer.invite.updated:after', recordConsumerInviteUpdated);
Fabric.listen('consumer.invite.deleted:after', recordConsumerInviteDeleted);
Fabric.listen('consumer.surface.created:after', recordConsumerSurfaceCreated);
Fabric.listen('consumer.surface.updated:after', recordConsumerSurfaceUpdated);
Fabric.listen('consumer.surface.archived:after', recordConsumerSurfaceArchived);
Fabric.listen('consumer.session.created:after', recordConsumerSessionCreated);
Fabric.listen('consumer.session.revoked:after', recordConsumerSessionRevoked);
