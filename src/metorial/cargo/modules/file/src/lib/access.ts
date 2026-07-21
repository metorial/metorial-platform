import { resourceActorService } from '@metorial/module-resource-tenant';
import {
  resolveResourceScopeForOwner,
  type ResourceScopeOwner
} from '@metorial/module-resource-tenant';
import type { AnyAccessTagSelector } from '@metorial/module-access';

let fullCargoAccessPermissions = ['content_read', 'content_write'] as const;

export type InstanceCargoAccessContext = {
  member?: {
    actor: {
      oid: bigint;
      id: string;
      name: string;
    };
  };
  consumerProfile?: {
    consumer: {
      oid: bigint;
      id: string;
      name: string;
    };
  };
  accessTags?: AnyAccessTagSelector;
};

export type CargoAccessActor = {
  identifier?: string;
  name: string;
  organizationActorOid?: bigint;
  consumerOid?: bigint;
};

export type CargoStorePermission = 'content_read' | 'content_write';
export type CargoStoreAccess = 'private' | 'public_read' | 'public_write';

export type CargoAccessInput = {
  owner: ResourceScopeOwner;
  accessActor?: CargoAccessActor;
  accessTags?: AnyAccessTagSelector;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
};

export let getInstanceCargoAccess = (ctx: InstanceCargoAccessContext) => {
  if (ctx.member?.actor) {
    return {
      accessActor: {
        identifier: `mte-oac-${ctx.member.actor.id}`,
        name: ctx.member.actor.name,
        organizationActorOid: ctx.member.actor.oid
      },
      defaultPermissions: [...fullCargoAccessPermissions],
      overridePermissions: true
    };
  }

  if (ctx.consumerProfile?.consumer) {
    return {
      accessActor: {
        identifier: `mte-con-${ctx.consumerProfile.consumer.id}`,
        name: ctx.consumerProfile.consumer.name,
        consumerOid: ctx.consumerProfile.consumer.oid
      },
      accessTags: ctx.accessTags
    };
  }

  return {};
};

export let hasInstanceConsumerAccess = (ctx: InstanceCargoAccessContext) =>
  !!ctx.consumerProfile?.consumer && !ctx.member?.actor;

export let resolveCargoAccess = async (d: CargoAccessInput) => {
  let scope = await resolveResourceScopeForOwner(d.owner);
  let actor =
    d.accessActor?.organizationActorOid != null
      ? await resourceActorService.ensureOrganizationActor({
          resourceTenant: scope.resourceTenant,
          organizationActorOid: d.accessActor.organizationActorOid
        })
      : d.accessActor?.consumerOid != null
        ? await resourceActorService.ensureConsumerActor({
            resourceTenant: scope.resourceTenant,
            consumerOid: d.accessActor.consumerOid
          })
        : d.accessActor
          ? await resourceActorService.upsertActor({
              resourceTenant: scope.resourceTenant,
              input: {
                identifier: d.accessActor.identifier ?? d.accessActor.name,
                name: d.accessActor.name
              }
            })
          : undefined;

  return {
    scope,
    actorId: actor?.id,
    accessTags: d.accessTags,
    defaultPermissions: d.defaultPermissions,
    overridePermissions: d.overridePermissions
  };
};
