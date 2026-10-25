import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { AuditScope } from '@metorial/audit-scope';
import type { Instance, OrganizationActor, OrganizationMember, User } from '@metorial/db';
import {
  consumerProfileService,
  consumerSurfaceService
} from '@metorial/module-consumer-core';
import { consumerActorService } from '@metorial/module-consumer-entities';
import { ownershipAccessService } from '@metorial-subspace/module-tenant';

export let getOwnershipActor = (ctx: {
  actor?: OrganizationActor | null;
  consumerProfile?: object | null;
}) => {
  let profileActor =
    ctx.consumerProfile && 'organizationActor' in ctx.consumerProfile
      ? (ctx.consumerProfile.organizationActor as OrganizationActor | null | undefined)
      : undefined;

  return profileActor ?? ctx.actor ?? undefined;
};

let DASHBOARD_SURFACE_IDENTIFIER = 'dashboard';

export let resolveOwnedByCaller = async (
  ctx: {
    actor?: OrganizationActor | null;
    consumerProfile?: object | null;
    instance: Instance;
    member?: OrganizationMember | null;
    user?: User | null;
    auditScope: AuditScope;
  },
  ownedByCaller: boolean | undefined
) => {
  if (!ownedByCaller) return undefined;

  let organizationActor = getOwnershipActor(ctx);
  let ownershipAccess = await ownershipAccessService.getOwnershipAccess({
    instance: ctx.instance,
    organizationActor
  });
  if (!ownershipAccess.isEnforced) return undefined;

  if (ownershipAccess.kind !== 'member' || !ctx.member || !ctx.user) {
    throw new ServiceError(
      badRequestError({
        message: 'Only organization members can own resources.',
        description: 'owned_by_caller can only be used when authenticated as a member.'
      })
    );
  }

  let consumerSurface = await consumerSurfaceService.ensureInternalConsumerSurface({
    instance: ctx.instance,
    identifier: DASHBOARD_SURFACE_IDENTIFIER,
    name: 'Metorial Dashboard',
    type: 'organization_members'
  });

  let consumerProfile = await consumerProfileService.ensureConsumerProfile({
    surface: consumerSurface,
    email: ctx.user.email,
    name: ctx.user.name,
    member: ctx.member,
    auditScope: ctx.auditScope
  });

  let consumerActor = await consumerActorService.ensureDefaultConsumerActor({
    instance: ctx.instance,
    consumerProfile
  });

  await ownershipAccessService.invalidateOwnershipAccessor({
    instance: ctx.instance,
    organizationActor
  });

  return consumerActor.id;
};
