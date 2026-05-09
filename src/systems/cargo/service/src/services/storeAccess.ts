import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  Prisma,
  PrismaClient,
  Store,
  StoreParticipant,
  StoreParticipantPermissions,
  TenantActor
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { actorService } from './actor';
import type { CargoTenantEnvironment } from './filePurpose';

type DbClient = PrismaClient | Prisma.TransactionClient;

export type StoreAccessInput = {
  actorId?: string;
  defaultPermissions?: StoreParticipantPermissions[];
  overridePermissions?: boolean;
};

export type StoreAccessResult = {
  actor?: TenantActor;
  isOwner: boolean;
  relevantStoreOids: bigint[];
  accessibleStoreOids: bigint[];
};

let storeReadPermission: StoreParticipantPermissions = 'content_read';
let storeWritePermission: StoreParticipantPermissions = 'content_write';

let uniqueBigInts = (values: bigint[]) => [...new Set(values.map(value => value.toString()))].map(BigInt);

let samePermissions = (
  left: StoreParticipantPermissions[] | undefined,
  right: StoreParticipantPermissions[] | undefined
) =>
  JSON.stringify([...(left ?? [])].sort()) === JSON.stringify([...(right ?? [])].sort());

class StoreAccessServiceImpl {
  private getClient(client?: DbClient) {
    return client ?? db;
  }

  async getActorForAccess(d: Pick<CargoTenantEnvironment, 'tenant'> & StoreAccessInput) {
    if (!d.actorId) return undefined;

    return await actorService.getActorById({
      tenant: d.tenant,
      actorId: d.actorId
    });
  }

  async getStoreById(
    d: CargoTenantEnvironment & {
      storeId: string;
      client?: DbClient;
    }
  ) {
    let client = this.getClient(d.client);
    let store = await client.store.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.storeId
      }
    });

    if (!store) throw new ServiceError(notFoundError('store', d.storeId));

    return store;
  }

  async listRelevantStoreOidsForDocument(d: {
    document: {
      oid: bigint;
      fileOid: bigint;
    };
    client?: DbClient;
  }) {
    let client = this.getClient(d.client);
    let stores = await client.store.findMany({
      where: {
        items: {
          some: {
            OR: [{ documentOid: d.document.oid }, { fileOid: d.document.fileOid }]
          }
        }
      },
      select: {
        oid: true
      }
    });

    return stores.map(store => store.oid);
  }

  async listStoreParticipantActorsForDocument(d: {
    document: {
      oid: bigint;
      fileOid: bigint;
    };
    client?: DbClient;
  }) {
    let client = this.getClient(d.client);
    let storeOids = await this.listRelevantStoreOidsForDocument(d);
    if (storeOids.length === 0) return [];

    let participants = await client.storeParticipant.findMany({
      where: {
        storeOid: {
          in: storeOids
        }
      },
      include: {
        tenantActor: true
      }
    });

    let permissionsByActor = new Map<
      bigint,
      {
        actor: TenantActor;
        permissions: Set<StoreParticipantPermissions>;
      }
    >();

    for (let participant of participants) {
      let existing = permissionsByActor.get(participant.tenantActorOid);
      if (existing) {
        for (let permission of participant.permissions) {
          existing.permissions.add(permission);
        }
        continue;
      }

      permissionsByActor.set(participant.tenantActorOid, {
        actor: participant.tenantActor,
        permissions: new Set(participant.permissions)
      });
    }

    return [...permissionsByActor.values()].map(item => ({
      actor: item.actor,
      mode: item.permissions.has(storeWritePermission) ? 'edit' : 'view'
    }));
  }

  private async upsertStoreParticipants(
    client: DbClient,
    d: {
      storeOids: bigint[];
      actor: TenantActor;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    if (d.storeOids.length === 0) return [] as StoreParticipant[];

    let participants = await client.storeParticipant.findMany({
      where: {
        storeOid: {
          in: d.storeOids
        },
        tenantActorOid: d.actor.oid
      }
    });

    let byStoreOid = new Map(participants.map(participant => [participant.storeOid.toString(), participant]));
    let nextPermissions = d.defaultPermissions ?? [];

    if (d.overridePermissions) {
      let updatedParticipants: StoreParticipant[] = [];

      for (let storeOid of d.storeOids) {
        let existing = byStoreOid.get(storeOid.toString());

        if (existing) {
          if (!samePermissions(existing.permissions, nextPermissions)) {
            existing = await client.storeParticipant.update({
              where: {
                id: existing.id
              },
              data: {
                permissions: nextPermissions
              }
            });
          }

          updatedParticipants.push(existing);
          continue;
        }

        let ids = getId('storeParticipant');
        updatedParticipants.push(
          await client.storeParticipant.create({
            data: {
              oid: ids.oid,
              id: ids.id,
              storeOid,
              tenantActorOid: d.actor.oid,
              permissions: nextPermissions
            }
          })
        );
      }

      return updatedParticipants;
    }

    if (d.defaultPermissions !== undefined) {
      for (let storeOid of d.storeOids) {
        if (byStoreOid.has(storeOid.toString())) continue;

        let ids = getId('storeParticipant');
        let participant = await client.storeParticipant.create({
          data: {
            oid: ids.oid,
            id: ids.id,
            storeOid,
            tenantActorOid: d.actor.oid,
            permissions: nextPermissions
          }
        });

        participants.push(participant);
      }
    }

    return participants;
  }

  private getAccessibleStoreOids(
    participants: Array<Pick<StoreParticipant, 'storeOid' | 'permissions'>>,
    requiredPermission: StoreParticipantPermissions
  ) {
    return participants
      .filter(participant => participant.permissions.includes(requiredPermission))
      .map(participant => participant.storeOid);
  }

  async resolveAccessibleStoreOids(
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        requiredPermission: StoreParticipantPermissions;
        storeOids: bigint[];
        client?: DbClient;
      }
  ) {
    let relevantStoreOids = uniqueBigInts(d.storeOids);
    if (!d.actorId) {
      return {
        actor: undefined,
        relevantStoreOids,
        accessibleStoreOids: relevantStoreOids
      };
    }

    let actor = await this.getActorForAccess(d);
    let client = this.getClient(d.client);
    let participants = actor
      ? await this.upsertStoreParticipants(client, {
          storeOids: relevantStoreOids,
          actor,
          defaultPermissions: d.defaultPermissions,
          overridePermissions: d.overridePermissions
        })
      : [];

    return {
      actor,
      relevantStoreOids,
      accessibleStoreOids: this.getAccessibleStoreOids(participants, d.requiredPermission)
    };
  }

  async listAccessibleStoreOidsForTenantEnvironment(
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        requiredPermission: StoreParticipantPermissions;
        client?: DbClient;
      }
  ) {
    let client = this.getClient(d.client);
    let stores = await client.store.findMany({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      select: {
        oid: true
      }
    });

    return await this.resolveAccessibleStoreOids({
      tenant: d.tenant,
      environment: d.environment,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: d.requiredPermission,
      storeOids: stores.map(store => store.oid),
      client
    });
  }

  async assertStoreAccessForStore(
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        store: Pick<Store, 'oid' | 'id'>;
        requiredPermission: StoreParticipantPermissions;
        client?: DbClient;
      }
  ) {
    let result = await this.resolveAccessibleStoreOids({
      tenant: d.tenant,
      environment: d.environment,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: d.requiredPermission,
      storeOids: [d.store.oid],
      client: d.client
    });

    if (
      d.actorId &&
      !result.accessibleStoreOids.some(storeOid => storeOid === d.store.oid)
    ) {
      throw new ServiceError(
        forbiddenError({
          message: `Missing ${d.requiredPermission} access for store ${d.store.id}`
        })
      );
    }

    return {
      ...result,
      isOwner: false
    } satisfies StoreAccessResult;
  }

  async assertStoreAccessForDocument(
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        document: {
          id: string;
          oid: bigint;
          fileOid: bigint;
          createdByTenantActorOid?: bigint | null;
        };
        requiredPermission: StoreParticipantPermissions;
        client?: DbClient;
      }
  ) {
    let actor = await this.getActorForAccess(d);
    let isOwner = !!actor && d.document.createdByTenantActorOid === actor.oid;
    let client = this.getClient(d.client);
    let relevantStoreOids = await this.listRelevantStoreOidsForDocument({
      document: d.document,
      client
    });
    let access = await this.resolveAccessibleStoreOids({
      tenant: d.tenant,
      environment: d.environment,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: d.requiredPermission,
      storeOids: relevantStoreOids,
      client
    });

    if (d.actorId && !isOwner && access.accessibleStoreOids.length === 0) {
      throw new ServiceError(
        forbiddenError({
          message: `Missing ${d.requiredPermission} access for document ${d.document.id}`
        })
      );
    }

    return {
      actor,
      isOwner,
      relevantStoreOids: access.relevantStoreOids,
      accessibleStoreOids: access.accessibleStoreOids
    } satisfies StoreAccessResult;
  }

  async assertStoreAccessForStoreItem(
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        item: {
          id: string;
          storeOid: bigint;
        };
        requiredPermission: StoreParticipantPermissions;
        client?: DbClient;
      }
  ) {
    let access = await this.resolveAccessibleStoreOids({
      tenant: d.tenant,
      environment: d.environment,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: d.requiredPermission,
      storeOids: [d.item.storeOid],
      client: d.client
    });

    if (d.actorId && access.accessibleStoreOids.length === 0) {
      throw new ServiceError(
        forbiddenError({
          message: `Missing ${d.requiredPermission} access for store item ${d.item.id}`
        })
      );
    }

    return {
      ...access,
      isOwner: false
    } satisfies StoreAccessResult;
  }
}

export let storeAccessService = Service.create(
  'cargoStoreAccessService',
  () => new StoreAccessServiceImpl()
).build();

export {
  storeReadPermission,
  storeWritePermission
};
