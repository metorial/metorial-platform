import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { AuditScope } from '@metorial/audit-scope';
import type { Instance, OrganizationActor, OrganizationMember } from '@metorial/db';
import {
  consumerProfileService,
  consumerSurfaceService
} from '@metorial/module-consumer-core';
import { consumerActorService } from '@metorial/module-consumer-entities';
import { ownershipAccessService } from '@metorial-subspace/module-tenant';
import type { AuthInfo } from '@metorial/module-access';

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

export let resolveExplorerOwner = async (
  ctx: {
    actor?: OrganizationActor | null;
    consumerProfile?: object | null;
    instance: Instance;
    member?: OrganizationMember | null;
    auth: AuthInfo;
    auditScope: AuditScope;
  },
  source: 'explorer' | undefined
) => {
  if (source !== 'explorer') return undefined;

  let organizationActor = getOwnershipActor(ctx);
  let ownershipAccess = await ownershipAccessService.getOwnershipAccess({
    instance: ctx.instance,
    organizationActor
  });
  if (!ownershipAccess.isEnforced) return undefined;

  let user =
    ctx.auth.type === 'user' || ctx.auth.type === 'machine' ? ctx.auth.user : undefined;

  if (ownershipAccess.kind !== 'member' || !ctx.member || !user) {
    throw new ServiceError(
      badRequestError({
        message: 'Only organization members can own resources.',
        description: 'Explorer resources can only be owned when authenticated as a member.'
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
    email: user.email,
    name: user.name,
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
