import { type Consumer, type OrganizationActor, type OrganizationMember } from '@metorial/db';
import type { AnyAccessTagSelector } from '@metorial/module-access';
import {
  resolveResourceScopeForOwner,
  resourceActorService
} from '@metorial/module-resource-tenant';

let fullCargoAccessPermissions = ['content_read', 'content_write'] as const;

export type InstanceCargoAccessContext = {
  instance: {
    id: string;
  };
  member?: OrganizationMember & {
    actor: OrganizationActor;
  };
  consumerProfile?: {
    consumer: Consumer;
  };
  accessTags?: AnyAccessTagSelector;
};

export let hasInstanceConsumerAccess = (ctx: InstanceCargoAccessContext) =>
  !!ctx.consumerProfile?.consumer && !ctx.member?.actor;

export let getInstanceCargoActorInput = (ctx: InstanceCargoAccessContext) => {
  if (ctx.member?.actor) {
    return {
      identifier: `mte-oac-${ctx.member.actor.id}`,
      name: ctx.member.actor.name,
      organizationActorOid: ctx.member.actor.oid
    };
  }

  if (ctx.consumerProfile?.consumer) {
    return {
      identifier: `mte-con-${ctx.consumerProfile.consumer.id}`,
      name: ctx.consumerProfile.consumer.name,
      consumerOid: ctx.consumerProfile.consumer.oid
    };
  }

  return undefined;
};

export let getInstanceCargoAccess = async (ctx: InstanceCargoAccessContext) => {
  let scope = await resolveResourceScopeForOwner({
    type: 'instance',
    instance: {
      id: ctx.instance.id
    }
  });

  let actorInput = getInstanceCargoActorInput(ctx);
  let actor = actorInput
    ? await resourceActorService.upsertActor({
        resourceTenant: scope.resourceTenant,
        input: actorInput
      })
    : undefined;

  return {
    resourceTenant: scope.resourceTenant,
    resourceGroup: scope.resourceGroup,
    actor,
    actorId: actor?.id,
    accessTags: hasInstanceConsumerAccess(ctx) ? ctx.accessTags : undefined,
    defaultPermissions: ctx.member?.actor ? [...fullCargoAccessPermissions] : undefined,
    overridePermissions: ctx.member?.actor ? true : undefined
  };
};
