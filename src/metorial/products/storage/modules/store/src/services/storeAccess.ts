import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  Instance,
  Project,
  ResourceActor,
  Store,
  StoreAccess,
  StoreParticipantPermissions,
  StoreParticipantRole
} from '@metorial/db';
import { withTransaction } from '@metorial/db';
import {
  type AnyAccessTagSelector,
  assertResourceAuthorizationScope,
  getStoreResourceAccessWhere,
  getStoreResourceKindAccessWhere,
  hasOrganizationMemberSkillAccess,
  type OrganizationMemberSkillAccessProject,
  type ResourceAuthorization,
  skillStoreResourceKind,
  standaloneStoreResourceAccess,
  storeAccessGrantService,
  storeResourceAccessLevels,
  type StoreResourceAccessLevel
} from '@metorial/module-access';
import { skillStoreResource } from '../lib/storeResource';
import { storeParticipantService } from './storeParticipant';

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
  canManageAccess: boolean;
};

export type DocumentPermissionsResult = BasePermissionsResult & {
  documentId: string;
  isOwner: boolean;
};

let storeReadPermission: StoreParticipantPermissions = 'content_read';
let storeWritePermission: StoreParticipantPermissions = 'content_write';

let uniqueBigInts = (values: bigint[]) =>
  [...new Set(values.map(value => value.toString()))].map(BigInt);

let storeAccessRoles: StoreParticipantRole[] = ['creator', 'editor', 'viewer'];
let storeEditorRoles: StoreParticipantRole[] = ['creator', 'editor'];

type GrantLevel = StoreResourceAccessLevel | 'none';

let getGrantLevel = (permissions: StoreParticipantPermissions[]): GrantLevel =>
  permissions.includes(storeWritePermission)
    ? 'write'
    : permissions.includes(storeReadPermission)
      ? 'read'
      : 'none';

let getHigherGrantLevel = (left: GrantLevel, right: GrantLevel) =>
  storeResourceAccessLevels.indexOf(left as StoreResourceAccessLevel) >=
  storeResourceAccessLevels.indexOf(right as StoreResourceAccessLevel)
    ? left
    : right;

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

        let rows = await db.storeParticipantActor.findMany({
          where: { storeOid: { in: storeOids } },
          include: { resourceActor: true }
        });

        let grantLevels = new Map<bigint, Map<bigint, StoreResourceAccessLevel>>();
        for (let storeOid of storeOids) {
          grantLevels.set(
            storeOid,
            await storeParticipantService.findConsumerGrantLevels({
              store: { oid: storeOid },
              consumerProfileOids: rows.flatMap(row =>
                row.storeOid == storeOid && row.resourceActor.consumerProfileOid
                  ? [row.resourceActor.consumerProfileOid]
                  : []
              )
            })
          );
        }

        let byActor = new Map<
          bigint,
          { actor: ResourceActor; mode: 'edit' | 'view'; storeParticipantOid: bigint | null }
        >();
        for (let row of rows) {
          let consumerProfileOid = row.resourceActor.consumerProfileOid;
          let grantLevel = consumerProfileOid
            ? grantLevels.get(row.storeOid)?.get(consumerProfileOid)
            : undefined;
          let hasAccessRole = row.roles.some(role => storeAccessRoles.includes(role));
          if (!hasAccessRole && !grantLevel) continue;

          let mode: 'edit' | 'view' =
            row.roles.some(role => storeEditorRoles.includes(role)) ||
            (grantLevel !== undefined && grantLevel !== 'read')
              ? 'edit'
              : 'view';
          let existing = byActor.get(row.resourceActorOid);

          byActor.set(row.resourceActorOid, {
            actor: row.resourceActor,
            mode: existing?.mode === 'edit' ? 'edit' : mode,
            storeParticipantOid: existing?.storeParticipantOid ?? row.storeParticipantOid
          });
        }

        return [...byActor.values()];
      },
      { ifExists: true }
    );
  }

  private async applyStandaloneStoreGrants(d: {
    actor: ResourceActor;
    storeOids: bigint[];
    permissions: StoreParticipantPermissions[];
    mode: 'set' | 'merge' | 'default';
  }) {
    let consumerProfileOid = d.actor.consumerProfileOid;
    if (!consumerProfileOid || d.storeOids.length === 0) return;

    let level = getGrantLevel(d.permissions);
    if (level === 'none' && d.mode !== 'set') return;

    await withTransaction(async db => {
      let profile = await db.consumerProfile.findUnique({
        where: { oid: consumerProfileOid },
        select: {
          organizationOid: true,
          personalConsumerGroup: { select: { accessTagOid: true } }
        }
      });
      if (!profile) return;

      let accessTagOid = profile.personalConsumerGroup.accessTagOid;
      let stores = await db.store.findMany({
        where: {
          oid: { in: uniqueBigInts(d.storeOids) },
          skill: { is: null }
        },
        select: { oid: true }
      });
      if (stores.length === 0) return;

      let grants = await storeAccessGrantService.listAccessTagGrants({
        storeOids: stores.map(store => store.oid),
        organizationOid: profile.organizationOid,
        access: standaloneStoreResourceAccess,
        accessTagOids: [accessTagOid]
      });
      let currentLevels = new Map<bigint, GrantLevel>(
        grants.map(grant => [grant.storeOid, grant.level])
      );

      for (let store of stores) {
        let currentLevel: GrantLevel = currentLevels.get(store.oid) ?? 'none';
        let nextLevel: GrantLevel =
          d.mode === 'set'
            ? level
            : d.mode === 'merge'
              ? getHigherGrantLevel(currentLevel, level)
              : currentLevel === 'none'
                ? level
                : currentLevel;
        if (nextLevel === currentLevel) continue;

        await storeAccessGrantService.setAccessLevel({
          store: { oid: store.oid, organizationOid: profile.organizationOid },
          access: standaloneStoreResourceAccess,
          accessTagOids: [accessTagOid],
          level: nextLevel
        });
      }
    });
  }

  private async recordMissingParticipation(d: { actor: ResourceActor; storeOids: bigint[] }) {
    let storeOids = uniqueBigInts(d.storeOids);
    if (storeOids.length === 0) return;

    let linkedRows = await withTransaction(
      async db =>
        await db.storeParticipantActor.findMany({
          where: {
            storeOid: { in: storeOids },
            resourceActorOid: d.actor.oid,
            storeParticipantOid: { not: null }
          },
          select: { storeOid: true }
        }),
      { ifExists: true }
    );
    let linkedStoreOids = new Set(linkedRows.map(row => row.storeOid));

    for (let storeOid of storeOids) {
      if (linkedStoreOids.has(storeOid)) continue;

      await storeParticipantService.recordParticipationSafely({
        store: { oid: storeOid },
        actor: d.actor
      });
    }
  }

  private async getAccessibleStoreOidsFromGrants(d: {
    project: OrganizationMemberSkillAccessProject;
    authorization: ResourceAuthorization;
    storeOids: bigint[];
    accessTags?: AnyAccessTagSelector;
    requiredPermission: StoreParticipantPermissions;
  }) {
    if (!d.storeOids.length) return [];

    let isWrite = d.requiredPermission === storeWritePermission;
    let accessWhere = await getStoreResourceAccessWhere({
      accessTags: d.accessTags,
      level: isWrite ? 'write' : 'read'
    });
    if (
      isWrite &&
      (await hasOrganizationMemberSkillAccess({
        project: d.project,
        authorization: d.authorization
      }))
    ) {
      accessWhere = {
        OR: [
          accessWhere,
          await getStoreResourceKindAccessWhere({
            kind: skillStoreResourceKind,
            accessTags: d.accessTags,
            level: 'read'
          })
        ]
      };
    }

    let stores = await withTransaction(
      async db =>
        await db.store.findMany({
          where: { oid: { in: d.storeOids }, AND: [accessWhere] },
          select: { oid: true }
        }),
      { ifExists: true }
    );

    return stores.map(store => store.oid);
  }

  async ensureActorStorePermissions(d: {
    store: Pick<Store, 'oid'>;
    actor: ResourceActor;
    permissions: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }) {
    await this.applyStandaloneStoreGrants({
      actor: d.actor,
      storeOids: [d.store.oid],
      permissions: d.permissions,
      mode: d.overridePermissions ? 'set' : 'merge'
    });
    await this.recordMissingParticipation({ actor: d.actor, storeOids: [d.store.oid] });
  }

  async resolveAccessibleStoreOids(
    d: StoreAccessInput & {
      project: OrganizationMemberSkillAccessProject;
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
            access: true,
            skill: { select: { oid: true } }
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
        if (!actor) {
          return { actor, relevantStoreOids, accessibleStoreOids: [] as bigint[] };
        }

        let appliesDefaults = d.defaultPermissions !== undefined || !!d.overridePermissions;
        if (appliesDefaults) {
          await this.applyStandaloneStoreGrants({
            actor,
            storeOids: relevantStoreOids,
            permissions: d.defaultPermissions ?? [],
            mode: d.overridePermissions ? 'set' : 'default'
          });
        }

        let publicStoreOids = stores
          .filter(
            store =>
              !store.skill &&
              getPublicStorePermissions({
                access: store.access,
                requiredPermission: d.requiredPermission
              })?.includes(d.requiredPermission)
          )
          .map(store => store.oid);
        await this.recordMissingParticipation({
          actor,
          storeOids: appliesDefaults ? relevantStoreOids : publicStoreOids
        });

        return {
          actor,
          relevantStoreOids,
          accessibleStoreOids: await this.getAccessibleStoreOidsFromGrants({
            project: d.project,
            authorization: d.authorization,
            storeOids: relevantStoreOids,
            accessTags: this.getAccessTags(d),
            requiredPermission: d.requiredPermission
          })
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

  private async canManageSkillStoreAccess(
    d: { project: Project } & StoreAccessInput & { store: Pick<Store, 'oid'> }
  ) {
    if (d.authorization.type == 'privileged') return true;

    let skill = await withTransaction(
      async db =>
        await db.skill.findFirst({ where: { storeOid: d.store.oid }, select: { oid: true } }),
      { ifExists: true }
    );
    if (!skill) return false;

    return await skillStoreResource.hasAccess({
      project: d.project,
      store: d.store,
      authorization: d.authorization,
      level: 'manage'
    });
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
        canManageAccess: false,
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
        canManageAccess: true,
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
      canManageAccess: await this.canManageSkillStoreAccess(d),
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
      project: OrganizationMemberSkillAccessProject;
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
      project: OrganizationMemberSkillAccessProject;
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
