import type { Instance, ResourceActor } from '@metorial/db';
import {
  createResourceAuthorization,
  type AnyAccessTagSelector,
  type ResourceAuthorization
} from '@metorial/module-access';
import { resourceActorService } from '@metorial/module-resource-actor';
import {
  cargoOwnerScopeProject,
  resolveOwnerScope,
  type CargoOwnerScope,
  type ScopeOwner
} from '../internal/ownerScope';

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
  project: {
    oid: bigint;
    id: string;
  };
  instance: Pick<Instance, 'oid' | 'projectOid'>;
  resourceActor?: ResourceActor;
  accessTags?: AnyAccessTagSelector;
};

export type CargoAccessActor = {
  resourceActorId?: string;
  identifier?: string;
  name: string;
  organizationActorOid?: bigint;
  consumerProfileOid?: bigint;
};

export type CargoStorePermission = 'content_read' | 'content_write';
export type CargoStoreAccess = 'private' | 'public_read' | 'public_write';

export type CargoAccessInput = {
  owner?: ScopeOwner;
  scope?: CargoOwnerScope;
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
    project: ctx.project,
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
        project: ctx.project,
        instance: ctx.instance
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
        project: ctx.project,
        instance: ctx.instance
      },
      resourceActor: ctx.resourceActor,
      authorization
    };
  }

  return {
    scope: {
      project: ctx.project,
      instance: ctx.instance
    },
    resourceActor: ctx.resourceActor,
    authorization
  };
};

export let hasInstanceConsumerAccess = (ctx: InstanceCargoAccessContext) =>
  !!ctx.consumerProfile?.consumer && !ctx.member?.actor;

export let resolveCargoAccess = async (d: CargoAccessInput) => {
  let scope: CargoOwnerScope | undefined = d.scope
    ? d.scope
    : d.owner
      ? await resolveOwnerScope(d.owner)
      : undefined;
  if (!scope) {
    throw new Error('Cargo access requires either a concrete scope or an owner');
  }

  let project = cargoOwnerScopeProject(scope);
  if (!project && (d.accessActor || d.resourceActor)) {
    throw new Error('Cargo access actors require a project-scoped owner');
  }

  let actor =
    d.resourceActor ??
    (!project || !d.accessActor
      ? undefined
      : d.accessActor.resourceActorId
        ? await resourceActorService.getActorById({
            project,
            actorId: d.accessActor.resourceActorId
          })
        : d.accessActor.organizationActorOid != null
          ? await resourceActorService.ensureOrganizationActor({
              project,
              organizationActorOid: d.accessActor.organizationActorOid
            })
          : d.accessActor.consumerProfileOid != null
            ? await resourceActorService.ensureConsumerProfileActor({
                project,
                consumerProfileOid: d.accessActor.consumerProfileOid
              })
            : await resourceActorService.upsertActor({
                project,
                input: {
                  identifier: d.accessActor.identifier ?? d.accessActor.name,
                  name: d.accessActor.name
                }
              }));

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
