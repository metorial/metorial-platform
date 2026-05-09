import { cargo } from '../cargo';
import type { FileOwner } from './file';
import { resolveCargoScopeForOwner } from './scope';

export type CargoAccessActor = {
  identifier: string;
  name: string;
  organizationActorId?: string;
  consumerId?: string;
};

export type CargoStorePermission = 'content_read' | 'content_write';

export type CargoAccessInput = {
  owner: FileOwner;
  accessActor?: CargoAccessActor;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
};

export let resolveCargoAccess = async (d: CargoAccessInput) => {
  let scope = await resolveCargoScopeForOwner(d.owner);
  let actor = d.accessActor
    ? await cargo.actor.upsert({
        tenantId: scope.tenantId,
        identifier: d.accessActor.identifier,
        name: d.accessActor.name,
        organizationActorId: d.accessActor.organizationActorId,
        consumerId: d.accessActor.consumerId
      })
    : undefined;

  return {
    scope,
    actorId: actor?.id,
    defaultPermissions: d.defaultPermissions,
    overridePermissions: d.overridePermissions
  };
};
