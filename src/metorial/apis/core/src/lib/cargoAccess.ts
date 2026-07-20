import {
  type Consumer,
  type OrganizationActor,
  type OrganizationMember,
  type ResourceActor,
  type ResourceGroup,
  type ResourceTenant
} from '@metorial/db';
import {
  createResourceAuthorization,
  type AnyAccessTagSelector
} from '@metorial/module-access';

let fullCargoAccessPermissions = ['content_read', 'content_write'] as const;

export type InstanceCargoAccessContext = {
  instance: {
    id: string;
    oid: bigint;
    resourceTenantOid: bigint | null;
    resourceGroupOid: bigint | null;
  };
  resourceTenant: ResourceTenant;
  resourceGroup: ResourceGroup;
  resourceActor?: ResourceActor;
  member?: OrganizationMember & {
    actor: OrganizationActor;
  };
  consumerProfile?: {
    oid: bigint;
    id: string;
    name: string;
    instanceOid: bigint;
    consumer: Consumer;
  };
  accessTags?: AnyAccessTagSelector;
};

export let hasInstanceConsumerAccess = (ctx: InstanceCargoAccessContext) =>
  !!ctx.consumerProfile?.consumer && !ctx.member?.actor;

export let getInstanceCargoActorInput = (ctx: InstanceCargoAccessContext) => {
  if (ctx.resourceActor) {
    return {
      resourceActorId: ctx.resourceActor.id,
      identifier: ctx.resourceActor.identifier,
      name: ctx.resourceActor.name
    };
  }

  if (ctx.member?.actor) {
    return {
      identifier: `mte-oac-${ctx.member.actor.id}`,
      name: ctx.member.actor.name,
      organizationActorOid: ctx.member.actor.oid
    };
  }

  if (ctx.consumerProfile?.consumer) {
    return {
      identifier: `mte-cpf-${ctx.consumerProfile.id}`,
      name: ctx.consumerProfile.name,
      consumerProfileOid: ctx.consumerProfile.oid
    };
  }

  return undefined;
};

export let getInstanceCargoAccess = async (ctx: InstanceCargoAccessContext) => {
  let restricted = hasInstanceConsumerAccess(ctx);
  let authorization = createResourceAuthorization({
    restricted,
    resourceActor: ctx.resourceActor,
    accessTags: ctx.accessTags,
    resourceTenant: ctx.resourceTenant,
    resourceGroup: ctx.resourceGroup,
    instance: ctx.instance,
    consumerProfile: ctx.consumerProfile
  });

  return {
    resourceTenant: ctx.resourceTenant,
    resourceGroup: ctx.resourceGroup,
    authorization,
    actor: ctx.resourceActor,
    actorId: ctx.resourceActor?.id,
    accessTags: restricted ? ctx.accessTags : undefined,
    defaultPermissions: ctx.member?.actor ? [...fullCargoAccessPermissions] : undefined,
    overridePermissions: ctx.member?.actor ? true : undefined
  };
};
