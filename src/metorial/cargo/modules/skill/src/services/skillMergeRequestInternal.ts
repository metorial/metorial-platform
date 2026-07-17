import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import {
  type DateFilter, normalizeDateFilter, resolveResourceActors, resolveSkills
} from '@metorial/cargo-list-utils';
import {
  flushDocumentCollaborationState, flushDocumentDraft
} from '@metorial/cargo-module-doc';
import { resourceActorService } from '@metorial/module-resource-tenant';
import { type ResourceScope } from '@metorial/module-resource-tenant';
import {
  storeAccessService,
  storeReadPermission,
  storeVersionService,
  storeWritePermission
} from '@metorial/cargo-module-store';
import type {
  SkillMergeRequestChangeType,
  SkillMergeRequestDirection,
  SkillMergeRequestItemStatus,
  SkillMergeRequestResolutionType,
  SkillMergeRequestStatus
} from '@metorial/db';
import { db, Prisma, withTransaction } from '@metorial/db';
import {
  getCanonicalSkillPairKey,
  getSkillMergeRequestActivePairKey,
  skillMergePairLock,
  skillMergeTargetLock
} from '../lib/mergeLock';
import {
  normalizeSnapshot,
  sameSnapshotItem,
  skillVersionSnapshotInclude,
  type Snapshot,
  type SnapshotItem
} from '../lib/mergeSnapshot';
import { skillMergeRequestEventService } from './skillMergeRequestEvent';

export let skillMergeRequestInclude = {
  sourceSkill: {
    include: {
      store: true
    }
  },
  targetSkill: {
    include: {
      store: true
    }
  },
  baseSourceSkillVersion: true,
  baseTargetSkillVersion: true,
  requestedSourceSkillVersion: true,
  requestedTargetSkillVersion: true,
  preMergeTargetSkillVersion: true,
  mergedTargetSkillVersion: true,
  rollbackTargetSkillVersion: true,
  createdByResourceActor: true,
  mergeStartedByResourceActor: true,
  mergedByResourceActor: true,
  closedByResourceActor: true,
  rolledBackByResourceActor: true,
  _count: {
    select: {
      items: true,
      comments: true
    }
  }
} satisfies Prisma.SkillMergeRequestInclude;

export let skillMergeRequestItemInclude = {
  skillMergeRequest: {
    include: {
      sourceSkill: {
        include: {
          store: true
        }
      },
      targetSkill: {
        include: {
          store: true
        }
      }
    }
  },
  baseFile: true,
  sourceFile: true,
  targetFile: true,
  baseDocument: true,
  sourceDocument: true,
  targetDocument: true,
  baseDocumentVersion: {
    include: {
      content: true
    }
  },
  sourceDocumentVersion: {
    include: {
      content: true
    }
  },
  targetDocumentVersion: {
    include: {
      content: true
    }
  },
  resolvedByResourceActor: true
} satisfies Prisma.SkillMergeRequestItemInclude;

export let skillMergeRequestCommentInclude = {
  skillMergeRequestItem: true,
  resourceActor: true,
  inReplyToComment: true
} satisfies Prisma.SkillMergeRequestCommentInclude;

export type SkillMergeRequestRecord = Prisma.SkillMergeRequestGetPayload<{
  include: typeof skillMergeRequestInclude;
}>;

export type SkillMergeRequestItemRecord = Prisma.SkillMergeRequestItemGetPayload<{
  include: typeof skillMergeRequestItemInclude;
}>;

export type SkillMergeRequestCommentRecord = Prisma.SkillMergeRequestCommentGetPayload<{
  include: typeof skillMergeRequestCommentInclude;
}>;

export type SkillRecord = Prisma.SkillGetPayload<{
  include: {
    store: true;
  };
}>;

export type SkillMergePlanItem = {
  item: SkillMergeRequestItemRecord;
  base?: SnapshotItem;
  source?: SnapshotItem;
  target?: SnapshotItem;
  documentMerge?: {
    baseContent?: string;
    sourceContent?: string;
    targetContent?: string;
    hasConflict: boolean;
  };
};

export type SkillMergePlan = {
  mergeRequest: SkillMergeRequestRecord;
  items: SkillMergePlanItem[];
};

let getResolutionStatus = (
  resolutionType: SkillMergeRequestResolutionType
): SkillMergeRequestItemStatus =>
  resolutionType === 'skip' || resolutionType === 'keep_target' ? 'skipped' : 'resolved';

class SkillMergeRequestInternalServiceImpl {
  async getSkill(d: ResourceScope & { skillId: string }) {
    let skill = await db.skill.findFirst({
      where: {
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid,
        id: d.skillId,
        status: 'active'
      },
      include: {
        store: true
      }
    });

    if (!skill) throw new ServiceError(notFoundError('skill', d.skillId));

    return skill;
  }

  async getRawSkillMergeRequestById(d: {
    resourceTenantOid?: bigint;
    resourceGroupOid?: bigint;
    skillMergeRequestId: string;
  }) {
    let mergeRequest = await db.skillMergeRequest.findFirst({
      where: {
        id: d.skillMergeRequestId,
        resourceTenantOid: d.resourceTenantOid,
        resourceGroupOid: d.resourceGroupOid
      },
      include: skillMergeRequestInclude
    });

    if (!mergeRequest) {
      throw new ServiceError(notFoundError('skill.mergeRequest', d.skillMergeRequestId));
    }

    return mergeRequest;
  }

  async getSkillVersionSnapshot(skillVersionOid: bigint) {
    let skillVersion = await db.skillVersion.findUnique({
      where: {
        oid: skillVersionOid
      },
      include: skillVersionSnapshotInclude
    });

    if (!skillVersion) {
      throw new ServiceError(notFoundError('skill.version', skillVersionOid.toString()));
    }

    return normalizeSnapshot(skillVersion);
  }

  async getSkillMergeRequestItemById(d: {
    mergeRequest: Pick<SkillMergeRequestRecord, 'oid'>;
    itemId: string;
  }) {
    let item = await db.skillMergeRequestItem.findFirst({
      where: {
        id: d.itemId,
        skillMergeRequestOid: d.mergeRequest.oid
      },
      include: skillMergeRequestItemInclude
    });

    if (!item) throw new ServiceError(notFoundError('skill.mergeRequest.item', d.itemId));

    return item;
  }

  async getSkillVersionForStoreVersion(d: {
    skill: Pick<SkillRecord, 'oid' | 'id'>;
    storeVersionId: string;
  }) {
    let skillVersion = await db.skillVersion.findFirst({
      where: {
        skillOid: d.skill.oid,
        storeVersion: {
          id: d.storeVersionId
        }
      }
    });

    if (!skillVersion) {
      throw new ServiceError(
        badRequestError({
          message: `Failed to create skill version snapshot for skill ${d.skill.id}`
        })
      );
    }

    return skillVersion;
  }

  async flushSkillForMergeSnapshot(d: { skill: SkillRecord }) {
    let documentItems = await db.storeItem.findMany({
      where: {
        storeOid: d.skill.storeOid!,
        document: {
          isNot: null
        }
      },
      include: {
        document: {
          select: {
            id: true
          }
        }
      }
    });

    for (let item of documentItems) {
      if (!item.document) continue;

      await flushDocumentCollaborationState({
        documentId: item.document.id
      });
      await flushDocumentDraft({
        documentId: item.document.id,
        force: true
      });
    }

    let snapshot = await storeVersionService.createStoreVersionSnapshotNow({
      storeId: d.skill.store!.id
    });

    return await this.getSkillVersionForStoreVersion({
      skill: d.skill,
      storeVersionId: snapshot.version.id
    });
  }

  async getExactBaseVersion(d: {
    sourceSkill: SkillRecord;
    targetSkill: SkillRecord;
    direction: SkillMergeRequestDirection;
  }) {
    let forkSkill = d.direction === 'fork_to_upstream' ? d.sourceSkill : d.targetSkill;
    let upstreamSkill = d.direction === 'fork_to_upstream' ? d.targetSkill : d.sourceSkill;

    if (!forkSkill.forkedFromSkillVersionOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Merge requests require a fork with a recorded base version'
        })
      );
    }

    let baseVersion = await db.skillVersion.findFirst({
      where: {
        oid: forkSkill.forkedFromSkillVersionOid,
        skillOid: upstreamSkill.oid
      }
    });

    if (!baseVersion) {
      throw new ServiceError(
        badRequestError({
          message: 'The fork base version is not part of the target skill'
        })
      );
    }

    return baseVersion;
  }

  async getMergeBases(d: {
    sourceSkill: SkillRecord;
    targetSkill: SkillRecord;
    direction: SkillMergeRequestDirection;
  }) {
    let previousMergeRequest = await db.skillMergeRequest.findFirst({
      where: {
        OR: [
          {
            sourceSkillOid: d.sourceSkill.oid,
            targetSkillOid: d.targetSkill.oid
          },
          {
            sourceSkillOid: d.targetSkill.oid,
            targetSkillOid: d.sourceSkill.oid
          }
        ],
        status: 'merged',
        rolledBackAt: null,
        mergedTargetSkillVersionOid: {
          not: null
        }
      },
      include: {
        requestedSourceSkillVersion: true,
        mergedTargetSkillVersion: true
      },
      orderBy: [{ mergedAt: 'desc' }, { oid: 'desc' }]
    });

    if (previousMergeRequest?.mergedTargetSkillVersion) {
      let rollbackInvalidatingPreviousMerge =
        d.direction === 'fork_to_upstream' && previousMergeRequest.mergedAt
          ? await db.skillMergeRequest.findFirst({
              where: {
                targetSkillOid: d.targetSkill.oid,
                direction: 'fork_to_upstream',
                status: 'merged',
                mergedAt: {
                  lte: previousMergeRequest.mergedAt
                },
                rolledBackAt: {
                  gte: previousMergeRequest.mergedAt
                },
                rollbackTargetSkillVersionOid: {
                  not: null
                }
              },
              include: {
                rollbackTargetSkillVersion: true
              },
              orderBy: [{ rolledBackAt: 'desc' }, { oid: 'desc' }]
            })
          : null;

      if (rollbackInvalidatingPreviousMerge?.rollbackTargetSkillVersion) {
        return {
          sourceBaseVersion: rollbackInvalidatingPreviousMerge.rollbackTargetSkillVersion,
          targetBaseVersion: rollbackInvalidatingPreviousMerge.rollbackTargetSkillVersion,
          baseStrategy: 'inferred_current' as const
        };
      }

      let sameOrientation =
        previousMergeRequest.sourceSkillOid === d.sourceSkill.oid &&
        previousMergeRequest.targetSkillOid === d.targetSkill.oid;
      return {
        sourceBaseVersion: sameOrientation
          ? previousMergeRequest.requestedSourceSkillVersion
          : previousMergeRequest.mergedTargetSkillVersion,
        targetBaseVersion: sameOrientation
          ? previousMergeRequest.mergedTargetSkillVersion
          : previousMergeRequest.requestedSourceSkillVersion,
        baseStrategy: 'inferred_current' as const
      };
    }

    let exactBaseVersion = await this.getExactBaseVersion(d);
    return {
      sourceBaseVersion: exactBaseVersion,
      targetBaseVersion: exactBaseVersion,
      baseStrategy: 'exact' as const
    };
  }

  buildMergeItems(d: {
    mergeRequestOid: bigint;
    sourceBase: Snapshot;
    targetBase: Snapshot;
    source: Snapshot;
    target: Snapshot;
  }) {
    let paths = new Set([
      ...d.sourceBase.itemsByPath.keys(),
      ...d.targetBase.itemsByPath.keys(),
      ...d.source.itemsByPath.keys(),
      ...d.target.itemsByPath.keys()
    ]);
    let data: Prisma.SkillMergeRequestItemCreateManyInput[] = [];

    for (let path of [...paths].sort()) {
      let sourceBase = d.sourceBase.itemsByPath.get(path);
      let targetBase = d.targetBase.itemsByPath.get(path);
      let source = d.source.itemsByPath.get(path);
      let target = d.target.itemsByPath.get(path);
      let sourceChanged = !sameSnapshotItem(sourceBase, source);
      let targetChanged = !sameSnapshotItem(targetBase, target);

      if (!sourceChanged) continue;
      if (sameSnapshotItem(source, target)) continue;

      let changeType: SkillMergeRequestChangeType = 'modified';
      let conflictReason: string | undefined;
      let resolutionType: SkillMergeRequestResolutionType | undefined = source
        ? 'accept_source'
        : 'remove';
      let status: SkillMergeRequestItemStatus = 'resolved';

      if (!sourceBase && source) changeType = 'added';
      if (sourceBase && !source) changeType = 'removed';
      if (sourceChanged && targetChanged && !sameSnapshotItem(source, target)) {
        changeType = 'conflicted';
        conflictReason = 'source_and_target_changed';
        resolutionType = undefined;
        status = 'unresolved';
      }

      let representative = source ?? sourceBase ?? target ?? targetBase;
      if (!representative) continue;
      let ids = getId('skillMergeRequestItem');

      data.push({
        oid: ids.oid,
        id: ids.id,
        skillMergeRequestOid: d.mergeRequestOid,
        path,
        kind: representative.kind,
        changeType,
        status,
        resolutionType,
        conflictReason,
        baseFileOid: sourceBase?.fileOid ?? null,
        sourceFileOid: source?.fileOid ?? null,
        targetFileOid: target?.fileOid ?? null,
        baseDocumentOid: sourceBase?.documentOid ?? null,
        baseDocumentTitle: sourceBase?.documentTitle ?? null,
        sourceDocumentOid: source?.documentOid ?? null,
        sourceDocumentTitle: source?.documentTitle ?? null,
        targetDocumentOid: target?.documentOid ?? null,
        targetDocumentTitle: target?.documentTitle ?? null,
        baseDocumentVersionOid: sourceBase?.documentVersionOid ?? null,
        sourceDocumentVersionOid: source?.documentVersionOid ?? null,
        targetDocumentVersionOid: target?.documentVersionOid ?? null
      });
    }

    return data;
  }

  async reconcileMergeRequestWithTarget(d: {
    mergeRequest: SkillMergeRequestRecord;
    targetSkillVersionOid: bigint;
  }) {
    let sourceBase = await this.getSkillVersionSnapshot(
      d.mergeRequest.baseSourceSkillVersionOid ?? d.mergeRequest.baseTargetSkillVersionOid
    );
    let targetBase = await this.getSkillVersionSnapshot(
      d.mergeRequest.baseTargetSkillVersionOid
    );
    let source = await this.getSkillVersionSnapshot(
      d.mergeRequest.requestedSourceSkillVersionOid
    );
    let previousTarget = await this.getSkillVersionSnapshot(
      d.mergeRequest.requestedTargetSkillVersionOid
    );
    let target = await this.getSkillVersionSnapshot(d.targetSkillVersionOid);
    let nextItems = this.buildMergeItems({
      mergeRequestOid: d.mergeRequest.oid,
      sourceBase,
      targetBase,
      source,
      target
    });
    let currentItems = await db.skillMergeRequestItem.findMany({
      where: {
        skillMergeRequestOid: d.mergeRequest.oid
      }
    });
    let currentItemsByPath = new Map(currentItems.map(item => [item.path, item]));

    await withTransaction(async tx => {
      for (let nextItem of nextItems) {
        let currentItem = currentItemsByPath.get(nextItem.path);
        if (!currentItem) {
          await tx.skillMergeRequestItem.create({
            data: nextItem
          });
          continue;
        }

        let targetStayedTheSame = sameSnapshotItem(
          previousTarget.itemsByPath.get(nextItem.path),
          target.itemsByPath.get(nextItem.path)
        );
        let preserveResolution =
          targetStayedTheSame &&
          currentItem.status !== 'unresolved' &&
          currentItem.status !== 'applied' &&
          !!currentItem.resolutionType;
        let resolutionType = preserveResolution
          ? currentItem.resolutionType
          : nextItem.resolutionType;
        let status = resolutionType ? getResolutionStatus(resolutionType) : nextItem.status;

        await tx.skillMergeRequestItem.update({
          where: {
            id: currentItem.id
          },
          data: {
            kind: nextItem.kind,
            changeType: nextItem.changeType,
            status,
            resolutionType: resolutionType ?? null,
            resolution: preserveResolution
              ? (currentItem.resolution ?? Prisma.JsonNull)
              : Prisma.JsonNull,
            conflictReason: nextItem.conflictReason ?? null,
            baseFileOid: nextItem.baseFileOid,
            sourceFileOid: nextItem.sourceFileOid,
            targetFileOid: nextItem.targetFileOid,
            baseDocumentOid: nextItem.baseDocumentOid,
            baseDocumentTitle: nextItem.baseDocumentTitle,
            sourceDocumentOid: nextItem.sourceDocumentOid,
            sourceDocumentTitle: nextItem.sourceDocumentTitle,
            targetDocumentOid: nextItem.targetDocumentOid,
            targetDocumentTitle: nextItem.targetDocumentTitle,
            baseDocumentVersionOid: nextItem.baseDocumentVersionOid,
            sourceDocumentVersionOid: nextItem.sourceDocumentVersionOid,
            targetDocumentVersionOid: nextItem.targetDocumentVersionOid
          }
        });
        currentItemsByPath.delete(nextItem.path);
      }

      for (let staleItem of currentItemsByPath.values()) {
        await tx.skillMergeRequestItem.update({
          where: {
            id: staleItem.id
          },
          data: {
            changeType: 'unchanged',
            status: 'skipped',
            resolutionType: 'skip',
            resolution: Prisma.JsonNull,
            conflictReason: 'already_merged_upstream'
          }
        });
      }
    });
  }

  async assertReadEitherSkill(
    d: ResourceScope & {
      mergeRequest: SkillMergeRequestRecord;
      actorId?: string;
    }
  ) {
    try {
      await storeAccessService.assertStoreAccessForStore({
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        store: d.mergeRequest.sourceSkill.store!,
        actorId: d.actorId,
        requiredPermission: storeReadPermission
      });
      return;
    } catch (err) {
      if (!d.actorId) throw err;
    }

    await storeAccessService.assertStoreAccessForStore({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      store: d.mergeRequest.targetSkill.store!,
      actorId: d.actorId,
      requiredPermission: storeReadPermission
    });
  }

  async assertTargetWrite(
    d: ResourceScope & {
      mergeRequest: SkillMergeRequestRecord;
      actorId?: string;
    }
  ) {
    return await storeAccessService.assertStoreAccessForStore({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      store: d.mergeRequest.targetSkill.store!,
      actorId: d.actorId,
      requiredPermission: storeWritePermission
    });
  }

  async canCloseAsRequester(d: { mergeRequest: SkillMergeRequestRecord; actorId?: string }) {
    if (!d.actorId || !d.mergeRequest.createdByResourceActor) return !d.actorId;
    return d.mergeRequest.createdByResourceActor.id === d.actorId;
  }

  async getVisibleMergeRequestWhere(d: {
    resourceTenantOid: bigint;
    resourceGroupOid: bigint;
    actorOid?: bigint;
  }) {
    let readableStoreWhere: Prisma.StoreWhereInput = {
      OR: d.actorOid
        ? [
            { access: { in: ['public_read', 'public_write'] } },
            { createdByResourceActorOid: d.actorOid },
            {
              storeParticipants: {
                some: {
                  resourceActorOid: d.actorOid,
                  permissions: {
                    hasSome: [storeReadPermission, storeWritePermission]
                  }
                }
              }
            }
          ]
        : [{ access: { in: ['public_read', 'public_write'] } }]
    };

    return {
      resourceTenantOid: d.resourceTenantOid,
      resourceGroupOid: d.resourceGroupOid,
      OR: [
        {
          sourceSkill: {
            store: readableStoreWhere
          }
        },
        {
          targetSkill: {
            store: readableStoreWhere
          }
        }
      ]
    } satisfies Prisma.SkillMergeRequestWhereInput;
  }

  async createSkillMergeRequest(
    d: ResourceScope & {
      sourceSkillId: string;
      targetSkillId?: string;
      actorId?: string;
      title: string;
      description?: string | null;
    }
  ) {
    return (await this.createDirectedSkillMergeRequest({
      ...d,
      direction: 'fork_to_upstream'
    }))!;
  }

  async createDirectedSkillMergeRequest(
    d: ResourceScope & {
      sourceSkillId: string;
      targetSkillId?: string;
      actorId?: string;
      title: string;
      description?: string | null;
      direction: SkillMergeRequestDirection;
      returnNullOnNoChanges?: boolean;
      skillForkSyncId?: string;
    }
  ) {
    if (!d.title.trim()) {
      throw new ServiceError(
        badRequestError({ message: 'Merge request title cannot be empty' })
      );
    }

    let sourceSkill = await this.getSkill({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      skillId: d.sourceSkillId
    });
    let targetSkill = d.targetSkillId
      ? await this.getSkill({
          resourceTenant: d.resourceTenant!,
          resourceGroup: d.resourceGroup,
          skillId: d.targetSkillId
        })
      : d.direction === 'fork_to_upstream'
        ? await db.skill.findFirst({
            where: {
              oid: sourceSkill.parentSkillOid ?? -1n,
              resourceTenantOid: d.resourceTenant.oid,
              resourceGroupOid: d.resourceGroup.oid,
              status: 'active'
            },
            include: {
              store: true
            }
          })
        : null;

    if (!targetSkill) {
      throw new ServiceError(
        badRequestError({
          message: 'Source skill does not have an upstream skill'
        })
      );
    }

    let forkSkill = d.direction === 'fork_to_upstream' ? sourceSkill : targetSkill;
    let upstreamSkill = d.direction === 'fork_to_upstream' ? targetSkill : sourceSkill;
    if (forkSkill.parentSkillOid !== upstreamSkill.oid) {
      throw new ServiceError(
        badRequestError({
          message:
            d.direction === 'fork_to_upstream'
              ? 'Source skill must be a fork of the target skill'
              : 'Target skill must be a fork of the source skill'
        })
      );
    }

    let actor = d.actorId
      ? await resourceActorService.getActorById({
          resourceTenant: d.resourceTenant!,
          actorId: d.actorId
        })
      : undefined;

    await storeAccessService.assertStoreAccessForStore({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      store: sourceSkill.store!,
      actorId: d.actorId,
      requiredPermission: storeReadPermission
    });

    let pairKey = getCanonicalSkillPairKey(sourceSkill.oid, targetSkill.oid);
    let activePairKey = getSkillMergeRequestActivePairKey(
      sourceSkill.oid,
      targetSkill.oid,
      d.direction
    );
    return await skillMergePairLock.usingLock(pairKey, async () => {
      while (true) {
        let mergingMergeRequest = await db.skillMergeRequest.findFirst({
          where: {
            status: 'merging',
            OR: [
              {
                sourceSkillOid: sourceSkill.oid,
                targetSkillOid: targetSkill.oid
              },
              {
                sourceSkillOid: targetSkill.oid,
                targetSkillOid: sourceSkill.oid
              }
            ]
          },
          select: {
            id: true
          }
        });
        if (!mergingMergeRequest) break;

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return await skillMergeTargetLock.usingLock(targetSkill.store!.id, async () => {
        let existingActive = await db.skillMergeRequest.findMany({
          where: {
            status: 'open',
            direction: d.direction,
            OR: [
              {
                sourceSkillOid: sourceSkill.oid,
                targetSkillOid: targetSkill.oid
              },
              {
                sourceSkillOid: targetSkill.oid,
                targetSkillOid: sourceSkill.oid
              }
            ]
          }
        });

        let requestedSourceVersion = await this.flushSkillForMergeSnapshot({
          skill: sourceSkill
        });
        let requestedTargetVersion = await this.flushSkillForMergeSnapshot({
          skill: targetSkill
        });
        let mergeBases = await this.getMergeBases({
          sourceSkill,
          targetSkill,
          direction: d.direction
        });
        let sourceBase = await this.getSkillVersionSnapshot(mergeBases.sourceBaseVersion.oid);
        let targetBase = await this.getSkillVersionSnapshot(mergeBases.targetBaseVersion.oid);
        let source = await this.getSkillVersionSnapshot(requestedSourceVersion.oid);
        let target = await this.getSkillVersionSnapshot(requestedTargetVersion.oid);
        let items = this.buildMergeItems({
          mergeRequestOid: 0n,
          sourceBase,
          targetBase,
          source,
          target
        });

        if (items.length === 0) {
          if (d.returnNullOnNoChanges) return null;
          throw new ServiceError(
            badRequestError({ message: 'The source skill has no changes to merge' })
          );
        }

        return await withTransaction(async tx => {
          if (existingActive.length > 0) {
            let closedAt = new Date();
            for (let existingMergeRequest of existingActive) {
              let closed = await tx.skillMergeRequest.updateMany({
                where: {
                  oid: existingMergeRequest.oid,
                  status: 'open'
                },
                data: {
                  status: 'closed',
                  activePairKey: null,
                  closedAt,
                  closedByResourceActorOid: actor?.oid
                }
              });

              if (closed.count !== 1) {
                throw new ServiceError(
                  badRequestError({ message: 'Active merge request is no longer replaceable' })
                );
              }

              await tx.skillForkSync.updateMany({
                where: {
                  generatedMergeRequestOid: existingMergeRequest.oid,
                  status: {
                    in: ['pending', 'processing', 'action_required']
                  }
                },
                data: {
                  status: 'cancelled',
                  activePairKey: null,
                  cancelledAt: closedAt
                }
              });
              await skillMergeRequestEventService.createEvent({
                database: tx,
                mergeRequestOid: existingMergeRequest.oid,
                type: 'closed',
                actorOid: actor?.oid
              });
            }
          }

          let existingSync = await tx.skillForkSync.findFirst({
            where: {
              activePairKey,
              status: {
                in: ['pending', 'processing', 'action_required']
              }
            }
          });
          if (
            d.direction === 'upstream_to_fork' &&
            existingSync &&
            existingSync.id !== d.skillForkSyncId
          ) {
            throw new ServiceError(
              badRequestError({
                message: 'An active fork synchronization already exists for this fork'
              })
            );
          }

          let ids = getId('skillMergeRequest');
          let mergeRequest = await tx.skillMergeRequest.create({
            data: {
              oid: ids.oid,
              id: ids.id,
              title: d.title,
              description: d.description,
              resourceTenantOid: d.resourceTenant.oid,
              resourceGroupOid: d.resourceGroup.oid,
              sourceSkillOid: sourceSkill.oid,
              targetSkillOid: targetSkill.oid,
              direction: d.direction,
              activePairKey,
              baseSourceSkillVersionOid: mergeBases.sourceBaseVersion.oid,
              baseTargetSkillVersionOid: mergeBases.targetBaseVersion.oid,
              requestedSourceSkillVersionOid: requestedSourceVersion.oid,
              requestedTargetSkillVersionOid: requestedTargetVersion.oid,
              createdByResourceActorOid: actor?.oid,
              baseStrategy: mergeBases.baseStrategy
            },
            include: skillMergeRequestInclude
          });

          await tx.skillMergeRequestItem.createMany({
            data: items.map(item => ({ ...item, skillMergeRequestOid: mergeRequest.oid }))
          });
          await skillMergeRequestEventService.createEvent({
            database: tx,
            mergeRequestOid: mergeRequest.oid,
            type: 'created',
            actorOid: actor?.oid
          });
          if (d.skillForkSyncId) {
            await tx.skillForkSync.update({
              where: {
                id: d.skillForkSyncId
              },
              data: {
                generatedMergeRequestOid: mergeRequest.oid
              }
            });
          }

          return (await tx.skillMergeRequest.findUnique({
            where: {
              id: mergeRequest.id
            },
            include: skillMergeRequestInclude
          }))!;
        });
      });
    });
  }

  async listSkillMergeRequests(
    d: ResourceScope & {
      ids?: string[];
      sourceSkillIds?: string[];
      targetSkillIds?: string[];
      statuses?: SkillMergeRequestStatus[];
      createdByActorIds?: string[];
      createdAt?: DateFilter;
      actorId?: string;
    }
  ) {
    let actor = d.actorId
      ? await resourceActorService.getActorById({
          resourceTenant: d.resourceTenant!,
          actorId: d.actorId
        })
      : undefined;
    let visibleWhere = await this.getVisibleMergeRequestWhere({
      resourceTenantOid: d.resourceTenant.oid,
      resourceGroupOid: d.resourceGroup.oid,
      actorOid: actor?.oid
    });
    let sourceSkills = await resolveSkills(d, d.sourceSkillIds);
    let targetSkills = await resolveSkills(d, d.targetSkillIds);
    let createdByActors = await resolveResourceActors(d, d.createdByActorIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillMergeRequest.findMany({
            ...opts,
            where: {
              AND: [
                visibleWhere,
                d.ids ? { id: { in: d.ids } } : undefined!,
                sourceSkills ? { sourceSkillOid: sourceSkills.in } : undefined!,
                targetSkills ? { targetSkillOid: targetSkills.in } : undefined!,
                d.statuses ? { status: { in: d.statuses } } : undefined!,
                createdByActors
                  ? { createdByResourceActorOid: createdByActors.in }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
              ].filter(Boolean)
            },
            include: skillMergeRequestInclude,
            orderBy: {
              createdAt: 'desc'
            }
          })
      )
    );
  }

  async getSkillMergeRequestById(
    d: ResourceScope & {
      skillMergeRequestId: string;
      actorId?: string;
    }
  ) {
    let mergeRequest = await this.getRawSkillMergeRequestById({
      resourceTenantOid: d.resourceTenant.oid,
      resourceGroupOid: d.resourceGroup.oid,
      skillMergeRequestId: d.skillMergeRequestId
    });

    await this.assertReadEitherSkill({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      mergeRequest,
      actorId: d.actorId
    });

    return mergeRequest;
  }

  async getSkillMergePlan(d: { mergeRequest: SkillMergeRequestRecord }) {
    let base = await this.getSkillVersionSnapshot(
      d.mergeRequest.baseSourceSkillVersionOid ?? d.mergeRequest.baseTargetSkillVersionOid
    );
    let source = await this.getSkillVersionSnapshot(
      d.mergeRequest.requestedSourceSkillVersionOid
    );
    let target = await this.getSkillVersionSnapshot(
      d.mergeRequest.requestedTargetSkillVersionOid
    );
    let items = await db.skillMergeRequestItem.findMany({
      where: {
        skillMergeRequestOid: d.mergeRequest.oid
      },
      include: skillMergeRequestItemInclude,
      orderBy: {
        path: 'asc'
      }
    });

    return {
      mergeRequest: d.mergeRequest,
      items: items.map(item => {
        let baseItem = base.itemsByPath.get(item.path);
        let sourceItem = source.itemsByPath.get(item.path);
        let targetItem = target.itemsByPath.get(item.path);

        return {
          item,
          base: baseItem,
          source: sourceItem,
          target: targetItem,
          documentMerge:
            item.kind === 'document'
              ? {
                  baseContent: baseItem?.content,
                  sourceContent: sourceItem?.content,
                  targetContent: targetItem?.content,
                  hasConflict: item.changeType === 'conflicted'
                }
              : undefined
        };
      })
    } satisfies SkillMergePlan;
  }

  async assertReadableReplacementFile(
    d: ResourceScope & {
      mergeRequest: SkillMergeRequestRecord;
      actorId?: string;
      fileId: string;
    }
  ) {
    let file = await db.file.findFirst({
      where: {
        id: d.fileId,
        status: 'active',
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid
      },
      include: {
        storeItems: {
          include: {
            store: true
          }
        }
      }
    });
    if (!file) {
      throw new ServiceError(
        badRequestError({
          message: `Replacement file must be active and belong to this resourceTenant and resourceGroup`
        })
      );
    }

    for (let storeItem of file.storeItems) {
      try {
        await storeAccessService.assertStoreAccessForStore({
          resourceTenant: d.resourceTenant!,
          resourceGroup: d.resourceGroup,
          store: storeItem.store!,
          actorId: d.actorId,
          requiredPermission: storeReadPermission
        });
        return file;
      } catch (err) {
        if (!d.actorId) throw err;
      }
    }

    throw new ServiceError(
      badRequestError({
        message: `Replacement file must belong to a store the resolver can read`
      })
    );
  }

  async validateItemResolution(
    d: ResourceScope & {
      mergeRequest: SkillMergeRequestRecord;
      item: SkillMergeRequestItemRecord;
      actorId?: string;
      resolutionType: SkillMergeRequestResolutionType;
      resolution?: Prisma.InputJsonValue | null;
    }
  ) {
    let resolution = (d.resolution ?? {}) as {
      title?: unknown;
      content?: unknown;
      fileId?: unknown;
    };
    let sourceExists =
      d.item.changeType !== 'removed' &&
      (d.item.kind === 'directory' || Boolean(d.item.sourceFile || d.item.sourceDocument));
    let isNoop = d.resolutionType === 'keep_target' || d.resolutionType === 'skip';

    if (isNoop) return;

    if (!sourceExists) {
      if (d.resolutionType !== 'remove') {
        throw new ServiceError(
          badRequestError({
            message: `Only remove, keep_target, or skip can resolve ${d.item.path}`
          })
        );
      }
      return;
    }

    if (d.item.kind === 'directory') {
      if (d.resolutionType !== 'accept_source' && d.resolutionType !== 'remove') {
        throw new ServiceError(
          badRequestError({
            message: `Directories can only accept, remove, keep upstream, or skip at ${d.item.path}`
          })
        );
      }
      return;
    }

    if (d.item.kind === 'document') {
      if (d.resolutionType === 'accept_source') return;
      if (d.resolutionType !== 'edit_document' || typeof resolution.content !== 'string') {
        throw new ServiceError(
          badRequestError({
            message: `Documents require accept_source or edit_document with content at ${d.item.path}`
          })
        );
      }
      if (resolution.title !== undefined && typeof resolution.title !== 'string') {
        throw new ServiceError(
          badRequestError({ message: `Document title must be a string at ${d.item.path}` })
        );
      }
      return;
    }

    if (d.item.kind !== 'file') {
      throw new ServiceError(
        badRequestError({ message: `Unsupported item kind at ${d.item.path}` })
      );
    }

    if (d.resolutionType !== 'accept_source' && d.resolutionType !== 'replace_file') {
      throw new ServiceError(
        badRequestError({
          message: `Files can only accept or replace the source at ${d.item.path}`
        })
      );
    }

    if (d.resolutionType === 'accept_source') return;
    if (typeof resolution.fileId !== 'string' || !resolution.fileId) {
      throw new ServiceError(
        badRequestError({ message: `A replacement file is required for ${d.item.path}` })
      );
    }

    await this.assertReadableReplacementFile({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      mergeRequest: d.mergeRequest,
      actorId: d.actorId,
      fileId: resolution.fileId
    });
  }

  getResolutionStatus(resolutionType: SkillMergeRequestResolutionType) {
    return getResolutionStatus(resolutionType);
  }
}

export let skillMergeRequestInternalService = Service.create(
  'cargoSkillMergeRequestInternalService',
  () => new SkillMergeRequestInternalServiceImpl()
).build();
