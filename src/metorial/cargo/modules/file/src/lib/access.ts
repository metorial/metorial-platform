import type { Instance, ResourceActor } from '@metorial/db';
import {
  createResourceAuthorization,
  type AnyAccessTagSelector,
  type ResourceAuthorization
} from '@metorial/module-access';
import {
  resolveResourceScopeForOwner,
  resourceActorService,
  type ResourceScope,
  type ResourceScopeOwner
} from '@metorial/module-resource-tenant';

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
    oid: bigint;
    id: string;
    name: string;
    instanceOid: bigint;
    consumer: {
      oid: bigint;
      id: string;
      name: string;
    };
  };
  instance: Pick<Instance, 'oid' | 'resourceTenantOid' | 'resourceGroupOid'>;
  resourceTenant: ResourceScope['resourceTenant'];
  resourceGroup: ResourceScope['resourceGroup'];
  resourceActor?: ResourceActor;
  accessTags?: AnyAccessTagSelector;
};

export type CargoAccessActor = {
  resourceActorId?: string;
  identifier?: string;
  name: string;
  organizationActorOid?: bigint;
  consumerOid?: bigint;
  consumerProfileOid?: bigint;
};

export type CargoStorePermission = 'content_read' | 'content_write';
export type CargoStoreAccess = 'private' | 'public_read' | 'public_write';

export type CargoAccessInput = {
  owner?: ResourceScopeOwner;
  scope?: ResourceScope;
  resourceActor?: ResourceActor;
  accessActor?: CargoAccessActor;
  accessTags?: AnyAccessTagSelector;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
  authorization?: ResourceAuthorization;
};

export let getInstanceCargoAccess = (ctx: InstanceCargoAccessContext) => {
  let authorization = createResourceAuthorization({
    restricted: hasInstanceConsumerAccess(ctx),
    resourceActor: ctx.resourceActor,
    accessTags: ctx.accessTags,
    resourceTenant: ctx.resourceTenant,
    resourceGroup: ctx.resourceGroup,
    instance: ctx.instance,
    consumerProfile: ctx.consumerProfile
  });

  if (ctx.member?.actor) {
    return {
      accessActor: {
        identifier: `mte-oac-${ctx.member.actor.id}`,
        name: ctx.member.actor.name,
        organizationActorOid: ctx.member.actor.oid
      },
      defaultPermissions: [...fullCargoAccessPermissions],
      overridePermissions: true,
      scope: {
        resourceTenant: ctx.resourceTenant,
        resourceGroup: ctx.resourceGroup
      },
      resourceActor: ctx.resourceActor,
      authorization
    };
  }

  if (ctx.consumerProfile?.consumer) {
    return {
      accessActor: {
        identifier: `mte-cpf-${ctx.consumerProfile.id}`,
        name: ctx.consumerProfile.name,
        consumerProfileOid: ctx.consumerProfile.oid
      },
      scope: {
        resourceTenant: ctx.resourceTenant,
        resourceGroup: ctx.resourceGroup
      },
      resourceActor: ctx.resourceActor,
      authorization
    };
  }

  return {
    scope: {
      resourceTenant: ctx.resourceTenant,
      resourceGroup: ctx.resourceGroup
    },
    resourceActor: ctx.resourceActor,
    authorization
  };
};

export let hasInstanceConsumerAccess = (ctx: InstanceCargoAccessContext) =>
  !!ctx.consumerProfile?.consumer && !ctx.member?.actor;

export let resolveCargoAccess = async (d: CargoAccessInput) => {
  let scope = d.scope
    ? d.scope
    : d.owner
      ? await resolveResourceScopeForOwner(d.owner)
      : undefined;
  if (!scope) {
    throw new Error('Cargo access requires either a concrete scope or an owner');
  }

  let actor =
    d.resourceActor ??
    (d.accessActor?.resourceActorId
      ? await resourceActorService.getActorById({
          resourceTenant: scope.resourceTenant,
          actorId: d.accessActor.resourceActorId
        })
      : d.accessActor?.organizationActorOid != null
        ? await resourceActorService.ensureOrganizationActor({
            resourceTenant: scope.resourceTenant,
            organizationActorOid: d.accessActor.organizationActorOid
          })
        : d.accessActor?.consumerOid != null
          ? await resourceActorService.ensureConsumerActor({
              resourceTenant: scope.resourceTenant,
              consumerOid: d.accessActor.consumerOid
            })
          : d.accessActor?.consumerProfileOid != null
            ? await resourceActorService.ensureConsumerProfileActor({
                resourceTenant: scope.resourceTenant,
                consumerProfileOid: d.accessActor.consumerProfileOid
              })
            : d.accessActor
              ? await resourceActorService.upsertActor({
                  resourceTenant: scope.resourceTenant,
                  input: {
                    identifier: d.accessActor.identifier ?? d.accessActor.name,
                    name: d.accessActor.name
                  }
                })
              : undefined);

  return {
    scope,
    actor,
    authorization: d.authorization ?? {
      type: 'privileged',
      resourceActor: actor
    },
    actorId: actor?.id,
    accessTags: d.accessTags,
    defaultPermissions: d.defaultPermissions,
    overridePermissions: d.overridePermissions
  };
};
