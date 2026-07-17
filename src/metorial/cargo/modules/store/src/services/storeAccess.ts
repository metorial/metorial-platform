import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import type { CargoResourceScope } from '@metorial/cargo-module-file';
import { actorService } from '@metorial/cargo-module-file';
import type {
  ResourceActor,
  Store,
  StoreAccess,
  StoreParticipant,
  StoreParticipantPermissions
} from '@metorial/db';
import { withTransaction } from '@metorial/db';

export type StoreAccessInput = {
  actorId?: string;
  defaultPermissions?: StoreParticipantPermissions[];
  overridePermissions?: boolean;
};

export type StoreAccessResult = {
  actor?: ResourceActor;
  isOwner: boolean;
  relevantStoreOids: bigint[];
  accessibleStoreOids: bigint[];
};

type BasePermissionsResult = {
  actorId?: string;
  hasFullAccess: boolean;
  permissions: StoreParticipantPermissions[];
  relevantStoreIds: string[];
  readableStoreIds: string[];
  writableStoreIds: string[];
};

export type StorePermissionsResult = BasePermissionsResult & {
  storeId: string;
};

export type DocumentPermissionsResult = BasePermissionsResult & {
  documentId: string;
  isOwner: boolean;
};

let storeReadPermission: StoreParticipantPermissions = 'content_read';
let storeWritePermission: StoreParticipantPermissions = 'content_write';

let uniqueBigInts = (values: bigint[]) =>
  [...new Set(values.map(value => value.toString()))].map(BigInt);
let uniquePermissions = (values: StoreParticipantPermissions[]) => [...new Set(values)];

let samePermissions = (
  left: StoreParticipantPermissions[] | undefined,
  right: StoreParticipantPermissions[] | undefined
) => JSON.stringify([...(left ?? [])].sort()) === JSON.stringify([...(right ?? [])].sort());

let mergePermissions = (
  left: StoreParticipantPermissions[] | undefined,
  right: StoreParticipantPermissions[] | undefined
) => uniquePermissions([...(left ?? []), ...(right ?? [])]);

let getPublicStorePermissions = (d: {
  access: StoreAccess;
  requiredPermission: StoreParticipantPermissions;
}) => {
  if (d.access === 'private') return undefined;

  if (d.access === 'public_read') {
    return d.requiredPermission === storeReadPermission ? [storeReadPermission] : undefined;
  }

  return [storeReadPermission, storeWritePermission];
};

class StoreAccessServiceImpl {
  private async resolveStoreIds(storeOids: bigint[]) {
    let uniqueStoreOids = uniqueBigInts(storeOids);
    if (uniqueStoreOids.length === 0) return [];

    let stores = await withTransaction(
      async db =>
        await db.store.findMany({
          where: {
            oid: {
              in: uniqueStoreOids
            }
          },
          select: {
            oid: true,
            id: true
          }
        }),
      { ifExists: true }
    );

    let storeIdByOid = new Map(stores.map(store => [store.oid.toString(), store.id]));

    return uniqueStoreOids
      .map(storeOid => storeIdByOid.get(storeOid.toString()))
      .filter((storeId): storeId is string => !!storeId);
  }

  private buildPermissions(d: {
    actorId?: string;
    isOwner?: boolean;
    readableStoreIds: string[];
    writableStoreIds: string[];
  }) {
    if (!d.actorId || d.isOwner) {
      return [
        storeReadPermission,
        storeWritePermission
      ] satisfies StoreParticipantPermissions[];
    }

    let permissions: StoreParticipantPermissions[] = [];

    if (d.readableStoreIds.length > 0) {
      permissions.push(storeReadPermission);
    }

    if (d.writableStoreIds.length > 0) {
      permissions.push(storeWritePermission);
    }

    return permissions;
  }

  async getActorForAccess(d: Pick<CargoResourceScope, 'resourceTenant'> & StoreAccessInput) {
    if (!d.actorId) return undefined;

    return await actorService.getActorById({
      resourceTenant: d.resourceTenant,
      actorId: d.actorId
    });
  }

  async getStoreById(
    d: CargoResourceScope & {
      storeId: string;
    }
  ) {
    return await withTransaction(
      async db => {
        let store = await db.store.findFirst({
          where: {
            resourceTenantOid: d.resourceTenant.oid,
            resourceGroupOid: d.resourceGroup.oid,
            id: d.storeId
          }
        });

        if (!store) throw new ServiceError(notFoundError('store', d.storeId));

        return store;
      },
      { ifExists: true }
    );
  }

  async listRelevantStoreOidsForDocument(d: {
    document: {
      oid: bigint;
      fileOid: bigint;
    };
  }) {
    return await withTransaction(
      async db => {
        let stores = await db.store.findMany({
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
      },
      { ifExists: true }
    );
  }

  async listRelevantStoreOidsForFile(d: {
    file: {
      oid: bigint;
    };
  }) {
    return await withTransaction(
      async db => {
        let stores = await db.store.findMany({
          where: {
            items: {
              some: {
                fileOid: d.file.oid
              }
            }
          },
          select: {
            oid: true
          }
        });

        return stores.map(store => store.oid);
      },
      { ifExists: true }
    );
  }

  async listStoreParticipantActorsForDocument(d: {
    document: {
      oid: bigint;
      fileOid: bigint;
    };
  }) {
    return await withTransaction(
      async db => {
        let storeOids = await this.listRelevantStoreOidsForDocument(d);
        if (storeOids.length === 0) return [];

        let participants = await db.storeParticipant.findMany({
          where: {
            storeOid: {
              in: storeOids
            }
          },
          include: {
            resourceActor: true
          }
        });

        let permissionsByActor = new Map<
          bigint,
          {
            actor: ResourceActor;
            permissions: Set<StoreParticipantPermissions>;
          }
        >();

        for (let participant of participants) {
          let existing = permissionsByActor.get(participant.resourceActorOid);
          if (existing) {
            for (let permission of participant.permissions) {
              existing.permissions.add(permission);
            }
            continue;
          }

          permissionsByActor.set(participant.resourceActorOid, {
            actor: participant.resourceActor,
            permissions: new Set(participant.permissions)
          });
        }

        return [...permissionsByActor.values()].map(item => ({
          actor: item.actor,
          mode: item.permissions.has(storeWritePermission) ? 'edit' : 'view'
        }));
      },
      { ifExists: true }
    );
  }

  private async upsertStoreParticipants(d: {
    storeOids: bigint[];
    actor: ResourceActor;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }) {
    return await withTransaction(
      async client => {
        let storeOids = uniqueBigInts(d.storeOids);
        if (storeOids.length === 0) return [] as StoreParticipant[];

        let participants = await client.storeParticipant.findMany({
          where: {
            storeOid: {
              in: storeOids
            },
            resourceActorOid: d.actor.oid
          }
        });

        let byStoreOid = new Map(
          participants.map(participant => [participant.storeOid.toString(), participant])
        );
        let nextPermissions = d.defaultPermissions ?? [];

        if (d.overridePermissions) {
          let updatedParticipants: StoreParticipant[] = [];

          for (let storeOid of storeOids) {
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
            let participant = await client.storeParticipant.upsert({
              where: {
                storeOid_resourceActorOid: {
                  storeOid,
                  resourceActorOid: d.actor.oid
                }
              },
              update: {
                permissions: nextPermissions
              },
              create: {
                oid: ids.oid,
                id: ids.id,
                storeOid,
                resourceActorOid: d.actor.oid,
                permissions: nextPermissions
              }
            });
            byStoreOid.set(storeOid.toString(), participant);
            updatedParticipants.push(participant);
          }

          return updatedParticipants;
        }

        if (d.defaultPermissions !== undefined) {
          for (let storeOid of storeOids) {
            if (byStoreOid.has(storeOid.toString())) continue;

            let ids = getId('storeParticipant');
            let participant = await client.storeParticipant.upsert({
              where: {
                storeOid_resourceActorOid: {
                  storeOid,
                  resourceActorOid: d.actor.oid
                }
              },
              update: {},
              create: {
                oid: ids.oid,
                id: ids.id,
                storeOid,
                resourceActorOid: d.actor.oid,
                permissions: nextPermissions
              }
            });

            byStoreOid.set(storeOid.toString(), participant);
            participants.push(participant);
          }
        }

        return participants;
      },
      { ifExists: true }
    );
  }

  private getAccessibleStoreOids(
    participants: Array<Pick<StoreParticipant, 'storeOid' | 'permissions'>>,
    requiredPermission: StoreParticipantPermissions
  ) {
    return participants
      .filter(participant => participant.permissions.includes(requiredPermission))
      .map(participant => participant.storeOid);
  }

  private async ensureStoreParticipantsHavePermissions(d: {
    actor: ResourceActor;
    items: Array<{
      storeOid: bigint;
      permissions: StoreParticipantPermissions[];
    }>;
  }) {
    return await withTransaction(
      async client => {
        if (d.items.length === 0) return [] as StoreParticipant[];

        let existingParticipants = await client.storeParticipant.findMany({
          where: {
            storeOid: {
              in: d.items.map(item => item.storeOid)
            },
            resourceActorOid: d.actor.oid
          }
        });

        let byStoreOid = new Map(
          existingParticipants.map(participant => [
            participant.storeOid.toString(),
            participant
          ])
        );
        let participants: StoreParticipant[] = [];

        for (let item of d.items) {
          let existing = byStoreOid.get(item.storeOid.toString());
          if (existing) {
            let nextPermissions = mergePermissions(existing.permissions, item.permissions);
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

            participants.push(existing);
            continue;
          }

          let ids = getId('storeParticipant');
          let participant = await client.storeParticipant.create({
            data: {
              oid: ids.oid,
              id: ids.id,
              storeOid: item.storeOid,
              resourceActorOid: d.actor.oid,
              permissions: item.permissions
            }
          });
          byStoreOid.set(item.storeOid.toString(), participant);
          participants.push(participant);
        }

        return participants;
      },
      { ifExists: true }
    );
  }

  async ensureActorStorePermissions(d: {
    store: Pick<Store, 'oid'>;
    actor: ResourceActor;
    permissions: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }) {
    if (d.overridePermissions) {
      let [participant] = await this.upsertStoreParticipants({
        storeOids: [d.store.oid],
        actor: d.actor,
        defaultPermissions: d.permissions,
        overridePermissions: true
      });

      return participant;
    }

    let [participant] = await this.ensureStoreParticipantsHavePermissions({
      actor: d.actor,
      items: [
        {
          storeOid: d.store.oid,
          permissions: d.permissions
        }
      ]
    });

    return participant;
  }

  async resolveAccessibleStoreOids(
    d: CargoResourceScope &
      StoreAccessInput & {
        requiredPermission: StoreParticipantPermissions;
        storeOids: bigint[];
      }
  ) {
    return await withTransaction(
      async db => {
        let relevantStoreOids = uniqueBigInts(d.storeOids);
        if (!d.actorId) {
          return {
            actor: undefined,
            relevantStoreOids,
            accessibleStoreOids: relevantStoreOids
          };
        }

        let actor = await this.getActorForAccess(d);
        let stores = await db.store.findMany({
          where: {
            resourceTenantOid: d.resourceTenant.oid,
            resourceGroupOid: d.resourceGroup.oid,
            oid: {
              in: relevantStoreOids
            }
          },
          select: {
            oid: true,
            access: true
          }
        });
        let participants = actor
          ? await this.upsertStoreParticipants({
              storeOids: relevantStoreOids,
              actor,
              defaultPermissions: d.defaultPermissions,
              overridePermissions: d.overridePermissions
            })
          : [];
        let publicStoreParticipants = actor
          ? await this.ensureStoreParticipantsHavePermissions({
              actor,
              items: stores
                .map(store => ({
                  storeOid: store.oid,
                  permissions: getPublicStorePermissions({
                    access: store.access,
                    requiredPermission: d.requiredPermission
                  })
                }))
                .filter(
                  (
                    item
                  ): item is {
                    storeOid: bigint;
                    permissions: StoreParticipantPermissions[];
                  } => item.permissions !== undefined
                )
            })
          : [];

        return {
          actor,
          relevantStoreOids,
          accessibleStoreOids: uniqueBigInts([
            ...this.getAccessibleStoreOids(participants, d.requiredPermission),
            ...this.getAccessibleStoreOids(publicStoreParticipants, d.requiredPermission)
          ])
        };
      },
      { ifExists: true }
    );
  }

  async listAccessibleStoreOidsForTenantEnvironment(
    d: CargoResourceScope &
      StoreAccessInput & {
        requiredPermission: StoreParticipantPermissions;
      }
  ) {
    return await withTransaction(
      async db => {
        let stores = await db.store.findMany({
          where: {
            resourceTenantOid: d.resourceTenant.oid,
            resourceGroupOid: d.resourceGroup.oid
          },
          select: {
            oid: true
          }
        });

        return await this.resolveAccessibleStoreOids({
          resourceTenant: d.resourceTenant,
          resourceGroup: d.resourceGroup,
          actorId: d.actorId,
          defaultPermissions: d.defaultPermissions,
          overridePermissions: d.overridePermissions,
          requiredPermission: d.requiredPermission,
          storeOids: stores.map(store => store.oid)
        });
      },
      { ifExists: true }
    );
  }

  async assertStoreAccessForStore(
    d: CargoResourceScope &
      StoreAccessInput & {
        store: Pick<Store, 'oid' | 'id'>;
        requiredPermission: StoreParticipantPermissions;
      }
  ) {
    let result = await this.resolveAccessibleStoreOids({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: d.requiredPermission,
      storeOids: [d.store.oid]
    });

    if (d.actorId && !result.accessibleStoreOids.some(storeOid => storeOid === d.store.oid)) {
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

  async getStorePermissions(
    d: CargoResourceScope &
      StoreAccessInput & {
        store: Pick<Store, 'oid' | 'id' | 'isReadOnly'>;
      }
  ) {
    if (d.store.isReadOnly) {
      return {
        storeId: d.store.id,
        actorId: d.actorId || undefined,
        hasFullAccess: false,
        permissions: [storeReadPermission],
        relevantStoreIds: [d.store.id],
        readableStoreIds: [d.store.id],
        writableStoreIds: []
      } satisfies StorePermissionsResult;
    }

    if (!d.actorId) {
      return {
        storeId: d.store.id,
        actorId: d.actorId || undefined,
        hasFullAccess: true,
        permissions: [storeReadPermission, storeWritePermission],
        relevantStoreIds: [d.store.id],
        readableStoreIds: [d.store.id],
        writableStoreIds: [d.store.id]
      } satisfies StorePermissionsResult;
    }

    let [readAccess, writeAccess] = await Promise.all([
      this.resolveAccessibleStoreOids({
        resourceTenant: d.resourceTenant,
        resourceGroup: d.resourceGroup,
        actorId: d.actorId,
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions,
        requiredPermission: storeReadPermission,
        storeOids: [d.store.oid]
      }),
      this.resolveAccessibleStoreOids({
        resourceTenant: d.resourceTenant,
        resourceGroup: d.resourceGroup,
        actorId: d.actorId,
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions,
        requiredPermission: storeWritePermission,
        storeOids: [d.store.oid]
      })
    ]);

    let readableStoreIds = await this.resolveStoreIds(readAccess.accessibleStoreOids);
    let writableStoreIds = await this.resolveStoreIds(writeAccess.accessibleStoreOids);
    let permissions = this.buildPermissions({
      actorId: d.actorId,
      readableStoreIds,
      writableStoreIds
    });

    return {
      storeId: d.store.id,
      actorId: d.actorId,
      hasFullAccess:
        permissions.includes(storeReadPermission) &&
        permissions.includes(storeWritePermission),
      permissions,
      relevantStoreIds: [d.store.id],
      readableStoreIds,
      writableStoreIds
    } satisfies StorePermissionsResult;
  }

  async assertStoreAccessForDocument(
    d: CargoResourceScope &
      StoreAccessInput & {
        document: {
          id: string;
          oid: bigint;
          fileOid: bigint;
          isReadOnly?: boolean;
          createdByResourceActorOid?: bigint | null;
        };
        requiredPermission: StoreParticipantPermissions;
      }
  ) {
    if (d.document.isReadOnly && d.requiredPermission === storeWritePermission) {
      throw new ServiceError(
        forbiddenError({
          message: `Document ${d.document.id} is read-only`
        })
      );
    }

    let actor = await this.getActorForAccess(d);
    let isOwner = !!actor && d.document.createdByResourceActorOid === actor.oid;
    let relevantStoreOids = await this.listRelevantStoreOidsForDocument({
      document: d.document
    });
    let access = await this.resolveAccessibleStoreOids({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: d.requiredPermission,
      storeOids: relevantStoreOids
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

  async getDocumentPermissions(
    d: CargoResourceScope &
      StoreAccessInput & {
        document: {
          id: string;
          oid: bigint;
          fileOid: bigint;
          isReadOnly?: boolean;
          createdByResourceActorOid?: bigint | null;
        };
      }
  ) {
    let actor = await this.getActorForAccess(d);
    let isOwner = !!actor && d.document.createdByResourceActorOid === actor.oid;
    let relevantStoreOids = await this.listRelevantStoreOidsForDocument({
      document: d.document
    });
    let relevantStoreIds = await this.resolveStoreIds(relevantStoreOids);

    if (d.document.isReadOnly) {
      return {
        documentId: d.document.id,
        actorId: d.actorId || undefined,
        isOwner,
        hasFullAccess: false,
        permissions: [storeReadPermission],
        relevantStoreIds,
        readableStoreIds: relevantStoreIds,
        writableStoreIds: []
      } satisfies DocumentPermissionsResult;
    }

    if (!d.actorId || isOwner) {
      return {
        documentId: d.document.id,
        actorId: d.actorId || undefined,
        isOwner,
        hasFullAccess: true,
        permissions: [storeReadPermission, storeWritePermission],
        relevantStoreIds,
        readableStoreIds: relevantStoreIds,
        writableStoreIds: relevantStoreIds
      } satisfies DocumentPermissionsResult;
    }

    let [readAccess, writeAccess] = await Promise.all([
      this.resolveAccessibleStoreOids({
        resourceTenant: d.resourceTenant,
        resourceGroup: d.resourceGroup,
        actorId: d.actorId,
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions,
        requiredPermission: storeReadPermission,
        storeOids: relevantStoreOids
      }),
      this.resolveAccessibleStoreOids({
        resourceTenant: d.resourceTenant,
        resourceGroup: d.resourceGroup,
        actorId: d.actorId,
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions,
        requiredPermission: storeWritePermission,
        storeOids: relevantStoreOids
      })
    ]);

    let readableStoreIds = await this.resolveStoreIds(readAccess.accessibleStoreOids);
    let writableStoreIds = await this.resolveStoreIds(writeAccess.accessibleStoreOids);
    let permissions = this.buildPermissions({
      actorId: d.actorId,
      isOwner,
      readableStoreIds,
      writableStoreIds
    });

    return {
      documentId: d.document.id,
      actorId: d.actorId,
      isOwner,
      hasFullAccess:
        permissions.includes(storeReadPermission) &&
        permissions.includes(storeWritePermission),
      permissions,
      relevantStoreIds,
      readableStoreIds,
      writableStoreIds
    } satisfies DocumentPermissionsResult;
  }

  async assertStoreAccessForFile(
    d: CargoResourceScope &
      StoreAccessInput & {
        file: {
          id: string;
          oid: bigint;
          createdByResourceActorOid?: bigint | null;
        };
        requiredPermission: StoreParticipantPermissions;
      }
  ) {
    let actor = await this.getActorForAccess(d);
    let isOwner = !!actor && d.file.createdByResourceActorOid === actor.oid;
    let relevantStoreOids = await this.listRelevantStoreOidsForFile({
      file: d.file
    });
    let access = await this.resolveAccessibleStoreOids({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: d.requiredPermission,
      storeOids: relevantStoreOids
    });

    if (d.actorId && !isOwner && access.accessibleStoreOids.length === 0) {
      throw new ServiceError(
        forbiddenError({
          message: `Missing ${d.requiredPermission} access for file ${d.file.id}`
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
    d: CargoResourceScope &
      StoreAccessInput & {
        item: {
          id: string;
          storeOid: bigint;
        };
        requiredPermission: StoreParticipantPermissions;
      }
  ) {
    let access = await this.resolveAccessibleStoreOids({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: d.requiredPermission,
      storeOids: [d.item.storeOid]
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

export { storeReadPermission, storeWritePermission };
