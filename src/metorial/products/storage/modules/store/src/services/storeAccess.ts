import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  Instance,
  Prisma,
  Project,
  ResourceActor,
  Store,
  StoreAccess,
  StoreParticipant,
  StoreParticipantPermissions
} from '@metorial/db';
import { ID, withTransaction } from '@metorial/db';
import {
  accessTagService,
  type AnyAccessTagSelector,
  assertResourceAuthorizationScope,
  consumerSkillReadRoles,
  consumerSkillWriteRoles,
  type ResourceAuthorization
} from '@metorial/module-access';

export type StoreAccessInput = {
  authorization: ResourceAuthorization;
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
  private getActor(d: StoreAccessInput) {
    return d.authorization.resourceActor;
  }

  private getAccessTags(d: StoreAccessInput): AnyAccessTagSelector | undefined {
    return d.authorization.type === 'restricted' ? d.authorization.accessTags : undefined;
  }

  private isPrivileged(d: StoreAccessInput) {
    return d.authorization.type === 'privileged';
  }

  private getAccessInput(d: StoreAccessInput): StoreAccessInput {
    return { authorization: d.authorization };
  }

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

  async getStoreById(d: { project: Project; instance: Instance; storeId: string }) {
    return await withTransaction(
      async db => {
        let store = await db.store.findFirst({
          where: {
            projectOid: d.project.oid,
            instanceOid: d.instance.oid,
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
                id: await ID.generateId('storeParticipant'),
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

            let participant = await client.storeParticipant.upsert({
              where: {
                storeOid_resourceActorOid: {
                  storeOid,
                  resourceActorOid: d.actor.oid
                }
              },
              update: {},
              create: {
                id: await ID.generateId('storeParticipant'),
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

  private async getSkillStoreAccess(d: {
    project: { oid: bigint };
    instance: { oid: bigint };
    actor: ResourceActor;
    accessTags?: AnyAccessTagSelector;
    requiredPermission: StoreParticipantPermissions;
    storeOids: bigint[];
  }) {
    let roles =
      d.requiredPermission === storeWritePermission
        ? [...consumerSkillWriteRoles]
        : [...consumerSkillReadRoles];
    let accessTagFilter = await accessTagService.getAccessTagFilter({
      tags: d.accessTags,
      roles
    });
    let accessFilters: Prisma.SkillWhereInput[] = [];

    if (accessTagFilter) {
      accessFilters.push({
        accessTagEntities: accessTagFilter
      });

      if (d.requiredPermission === storeReadPermission) {
        accessFilters.push({
          skillGroupItems: {
            some: {
              status: 'active',
              skillGroup: {
                status: 'active',
                accessTagEntities: accessTagFilter
              }
            }
          }
        });
      }
    }

    let [skillStores, accessibleSkills] = await withTransaction(
      async db =>
        await Promise.all([
          db.skill.findMany({
            where: {
              projectOid: d.project.oid,
              instanceOid: d.instance.oid,
              storeOid: {
                in: uniqueBigInts(d.storeOids)
              }
            },
            select: {
              storeOid: true
            }
          }),
          db.skill.findMany({
            where: {
              projectOid: d.project.oid,
              instanceOid: d.instance.oid,
              status: 'active',
              storeOid: {
                in: uniqueBigInts(d.storeOids)
              },
              OR: accessFilters
            },
            select: {
              storeOid: true
            }
          })
        ]),
      { ifExists: true }
    );

    return {
      skillStoreOids: skillStores
        .map(skill => skill.storeOid)
        .filter((storeOid): storeOid is bigint => storeOid != null),
      accessibleStoreOids: accessibleSkills
        .map(skill => skill.storeOid)
        .filter((storeOid): storeOid is bigint => storeOid != null)
    };
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

          let participant = await client.storeParticipant.create({
            data: {
              id: await ID.generateId('storeParticipant'),
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
    d: StoreAccessInput & {
      project: { oid: bigint };
      instance: { oid: bigint };
      requiredPermission: StoreParticipantPermissions;
      storeOids: bigint[];
    }
  ) {
    return await withTransaction(
      async db => {
        assertResourceAuthorizationScope(d);
        let requestedStoreOids = uniqueBigInts(d.storeOids);
        let stores = await db.store.findMany({
          where: {
            projectOid: d.project.oid,
            instanceOid: d.instance.oid,
            oid: {
              in: requestedStoreOids
            }
          },
          select: {
            oid: true,
            access: true
          }
        });
        let relevantStoreOids = stores.map(store => store.oid);
        let actor = await this.getActor(d);
        if (this.isPrivileged(d)) {
          return {
            actor,
            relevantStoreOids,
            accessibleStoreOids: relevantStoreOids
          };
        }

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
        let skillStoreAccess = actor
          ? await this.getSkillStoreAccess({
              project: d.project,
              instance: d.instance,
              actor,
              accessTags: this.getAccessTags(d),
              requiredPermission: d.requiredPermission,
              storeOids: relevantStoreOids
            })
          : { skillStoreOids: [], accessibleStoreOids: [] };
        let skillStoreOidSet = new Set(
          skillStoreAccess.skillStoreOids.map(storeOid => storeOid.toString())
        );
        let participantStoreOids = this.getAccessibleStoreOids(
          participants,
          d.requiredPermission
        ).filter(storeOid => !skillStoreOidSet.has(storeOid.toString()));

        return {
          actor,
          relevantStoreOids,
          accessibleStoreOids: uniqueBigInts([
            ...participantStoreOids,
            ...this.getAccessibleStoreOids(publicStoreParticipants, d.requiredPermission),
            ...skillStoreAccess.accessibleStoreOids
          ])
        };
      },
      { ifExists: true }
    );
  }

  async listAccessibleStoreOidsForTenantEnvironment(
    d: { project: Project; instance: Instance } & StoreAccessInput & {
        requiredPermission: StoreParticipantPermissions;
      }
  ) {
    return await withTransaction(
      async db => {
        let stores = await db.store.findMany({
          where: {
            projectOid: d.project.oid,
            instanceOid: d.instance.oid
          },
          select: {
            oid: true
          }
        });

        return await this.resolveAccessibleStoreOids({
          project: d.project,
          instance: d.instance,
          ...this.getAccessInput(d),
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
    d: StoreAccessInput & {
      project: { oid: bigint };
      instance: { oid: bigint };
      store: Pick<Store, 'oid' | 'id'>;
      requiredPermission: StoreParticipantPermissions;
    }
  ) {
    let result = await this.resolveAccessibleStoreOids({
      project: d.project,
      instance: d.instance,
      ...this.getAccessInput(d),
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: d.requiredPermission,
      storeOids: [d.store.oid]
    });

    if (
      !this.isPrivileged(d) &&
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

  async getStorePermissions(
    d: { project: Project; instance: Instance } & StoreAccessInput & {
        store: Pick<Store, 'oid' | 'id' | 'isReadOnly'>;
      }
  ) {
    if (d.store.isReadOnly) {
      return {
        storeId: d.store.id,
        actorId: (await this.getActor(d))?.id,
        hasFullAccess: false,
        permissions: [storeReadPermission],
        relevantStoreIds: [d.store.id],
        readableStoreIds: [d.store.id],
        writableStoreIds: []
      } satisfies StorePermissionsResult;
    }

    if (this.isPrivileged(d)) {
      return {
        storeId: d.store.id,
        actorId: (await this.getActor(d))?.id,
        hasFullAccess: true,
        permissions: [storeReadPermission, storeWritePermission],
        relevantStoreIds: [d.store.id],
        readableStoreIds: [d.store.id],
        writableStoreIds: [d.store.id]
      } satisfies StorePermissionsResult;
    }

    let [readAccess, writeAccess] = await Promise.all([
      this.resolveAccessibleStoreOids({
        project: d.project,
        instance: d.instance,
        ...this.getAccessInput(d),
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions,
        requiredPermission: storeReadPermission,
        storeOids: [d.store.oid]
      }),
      this.resolveAccessibleStoreOids({
        project: d.project,
        instance: d.instance,
        ...this.getAccessInput(d),
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions,
        requiredPermission: storeWritePermission,
        storeOids: [d.store.oid]
      })
    ]);

    let readableStoreIds = await this.resolveStoreIds(readAccess.accessibleStoreOids);
    let writableStoreIds = await this.resolveStoreIds(writeAccess.accessibleStoreOids);
    let permissions = this.buildPermissions({
      actorId: (await this.getActor(d))?.id,
      readableStoreIds,
      writableStoreIds
    });

    return {
      storeId: d.store.id,
      actorId: (await this.getActor(d))?.id,
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
    d: { project: Project; instance: Instance } & StoreAccessInput & {
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

    let actor = await this.getActor(d);
    let isOwner = !!actor && d.document.createdByResourceActorOid === actor.oid;
    let relevantStoreOids = await this.listRelevantStoreOidsForDocument({
      document: d.document
    });
    let access = await this.resolveAccessibleStoreOids({
      project: d.project,
      instance: d.instance,
      ...this.getAccessInput(d),
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: d.requiredPermission,
      storeOids: relevantStoreOids
    });

    if (!this.isPrivileged(d) && !isOwner && access.accessibleStoreOids.length === 0) {
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
    d: { project: Project; instance: Instance } & StoreAccessInput & {
        document: {
          id: string;
          oid: bigint;
          fileOid: bigint;
          isReadOnly?: boolean;
          createdByResourceActorOid?: bigint | null;
        };
      }
  ) {
    let actor = await this.getActor(d);
    let isOwner = !!actor && d.document.createdByResourceActorOid === actor.oid;
    let relevantStoreOids = await this.listRelevantStoreOidsForDocument({
      document: d.document
    });
    let relevantStoreIds = await this.resolveStoreIds(relevantStoreOids);

    if (d.document.isReadOnly) {
      return {
        documentId: d.document.id,
        actorId: actor?.id,
        isOwner,
        hasFullAccess: false,
        permissions: [storeReadPermission],
        relevantStoreIds,
        readableStoreIds: relevantStoreIds,
        writableStoreIds: []
      } satisfies DocumentPermissionsResult;
    }

    if (this.isPrivileged(d) || isOwner) {
      return {
        documentId: d.document.id,
        actorId: actor?.id,
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
        project: d.project,
        instance: d.instance,
        ...this.getAccessInput(d),
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions,
        requiredPermission: storeReadPermission,
        storeOids: relevantStoreOids
      }),
      this.resolveAccessibleStoreOids({
        project: d.project,
        instance: d.instance,
        ...this.getAccessInput(d),
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions,
        requiredPermission: storeWritePermission,
        storeOids: relevantStoreOids
      })
    ]);

    let readableStoreIds = await this.resolveStoreIds(readAccess.accessibleStoreOids);
    let writableStoreIds = await this.resolveStoreIds(writeAccess.accessibleStoreOids);
    let permissions = this.buildPermissions({
      actorId: actor?.id,
      isOwner,
      readableStoreIds,
      writableStoreIds
    });

    return {
      documentId: d.document.id,
      actorId: actor?.id,
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
    d: StoreAccessInput & {
      project: { oid: bigint };
      instance: { oid: bigint };
      file: {
        id: string;
        oid: bigint;
        createdByResourceActorOid?: bigint | null;
      };
      requiredPermission: StoreParticipantPermissions;
    }
  ) {
    let actor = await this.getActor(d);
    let isOwner = !!actor && d.file.createdByResourceActorOid === actor.oid;
    let relevantStoreOids = await this.listRelevantStoreOidsForFile({
      file: d.file
    });
    let access = await this.resolveAccessibleStoreOids({
      ...this.getAccessInput(d),
      project: d.project,
      instance: d.instance,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: d.requiredPermission,
      storeOids: relevantStoreOids
    });

    if (!this.isPrivileged(d) && !isOwner && access.accessibleStoreOids.length === 0) {
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
    d: StoreAccessInput & {
      project: { oid: bigint };
      instance: { oid: bigint };
      item: {
        id: string;
        storeOid: bigint;
      };
      requiredPermission: StoreParticipantPermissions;
    }
  ) {
    let access = await this.resolveAccessibleStoreOids({
      ...this.getAccessInput(d),
      project: d.project,
      instance: d.instance,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: d.requiredPermission,
      storeOids: [d.item.storeOid]
    });

    if (!this.isPrivileged(d) && access.accessibleStoreOids.length === 0) {
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
