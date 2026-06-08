import { ensureInternalActor } from '@metorial/internal-clients';
import type { FileOwner } from './file';
import { resolveCargoScopeForOwner } from './scope';

export type CargoAccessActor = {
  identifier?: string;
  name: string;
  organizationActorId?: string;
  consumerId?: string;
};

export type CargoStorePermission = 'content_read' | 'content_write';
export type CargoStoreAccess = 'private' | 'public_read' | 'public_write';

export type CargoAccessInput = {
  owner: FileOwner;
  accessActor?: CargoAccessActor;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
};

export let resolveCargoAccess = async (d: CargoAccessInput) => {
  let scope = await resolveCargoScopeForOwner(d.owner);
  let actor =
    d.accessActor?.organizationActorId != null
      ? await ensureInternalActor({
          service: 'cargo',
          tenantId: scope.tenantId,
          actor: {
            type: 'organizationActor',
            organizationActor: {
              id: d.accessActor.organizationActorId
            }
          }
        })
      : d.accessActor?.consumerId != null
        ? await ensureInternalActor({
            service: 'cargo',
            tenantId: scope.tenantId,
            actor: {
              type: 'consumer',
              consumer: {
                id: d.accessActor.consumerId
              }
            }
          })
        : undefined;

  return {
    scope,
    actorId: actor?.id,
    defaultPermissions: d.defaultPermissions,
    overridePermissions: d.overridePermissions
  };
};
