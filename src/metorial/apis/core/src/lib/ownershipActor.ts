import type { OrganizationActor } from '@metorial/db';

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
