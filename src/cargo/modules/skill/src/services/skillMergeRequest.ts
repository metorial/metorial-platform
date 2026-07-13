import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  SkillMergeRequestResolutionType,
  SkillMergeRequestStatus
} from '@metorial-cargo/db';
import { db, Prisma, withTransaction } from '@metorial-cargo/db';
import type { DateFilter } from '@metorial-cargo/list-utils';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { actorService } from '@metorial-cargo/module-file';
import { createSkillMergeRequestMergeError } from '../lib/mergeError';
import { skillMergeTargetLock } from '../lib/mergeLock';
import { enqueueSkillMergeRequestPerform } from '../queues/mergeRequest';
import { skillMergeRequestApplyInternalService } from './skillMergeRequestApplyInternal';
import { skillMergeRequestEventService } from './skillMergeRequestEvent';
import {
  skillMergeRequestInclude,
  skillMergeRequestInternalService,
  skillMergeRequestItemInclude,
  type SkillMergePlan,
  type SkillMergeRequestRecord
} from './skillMergeRequestInternal';

export type {
  SkillMergePlan,
  SkillMergePlanItem,
  SkillMergeRequestCommentRecord,
  SkillMergeRequestItemRecord,
  SkillMergeRequestRecord
} from './skillMergeRequestInternal';

class SkillMergeRequestServiceImpl {
  async createSkillMergeRequest(
    d: CargoTenantEnvironment & {
      sourceSkillId: string;
      targetSkillId?: string;
      actorId?: string;
      title: string;
      description?: string | null;
    }
  ) {
    return await skillMergeRequestInternalService.createSkillMergeRequest(d);
  }

  async listSkillMergeRequests(
    d: CargoTenantEnvironment & {
      ids?: string[];
      sourceSkillIds?: string[];
      targetSkillIds?: string[];
      statuses?: SkillMergeRequestStatus[];
      createdByActorIds?: string[];
      createdAt?: DateFilter;
      actorId?: string;
    }
  ) {
    return await skillMergeRequestInternalService.listSkillMergeRequests(d);
  }

  async getSkillMergeRequestById(
    d: CargoTenantEnvironment & {
      skillMergeRequestId: string;
      actorId?: string;
    }
  ) {
    return await skillMergeRequestInternalService.getSkillMergeRequestById(d);
  }

  async getSkillMergePlan(d: {
    mergeRequest: SkillMergeRequestRecord;
  }): Promise<SkillMergePlan> {
    return await skillMergeRequestInternalService.getSkillMergePlan(d);
  }

  async saveSkillMergeRequestItemResolution(
    d: CargoTenantEnvironment & {
      mergeRequest: SkillMergeRequestRecord;
      itemId: string;
      actorId?: string;
      resolutionType: SkillMergeRequestResolutionType;
      resolution?: Prisma.InputJsonValue | null;
    }
  ) {
    return await skillMergeTargetLock.usingLock(
      d.mergeRequest.targetSkill.store.id,
      async () => {
        let mergeRequest = await skillMergeRequestInternalService.getRawSkillMergeRequestById({
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          skillMergeRequestId: d.mergeRequest.id
        });
        if (mergeRequest.status !== 'open') {
          throw new ServiceError(
            badRequestError({ message: 'Only open merge requests can change' })
          );
        }

        let access = await skillMergeRequestInternalService.assertTargetWrite({
          tenant: d.tenant,
          environment: d.environment,
          mergeRequest,
          actorId: d.actorId
        });
        let item = await skillMergeRequestInternalService.getSkillMergeRequestItemById({
          mergeRequest,
          itemId: d.itemId
        });
        await skillMergeRequestInternalService.validateItemResolution({
          tenant: d.tenant,
          environment: d.environment,
          mergeRequest,
          item,
          actorId: d.actorId,
          resolutionType: d.resolutionType,
          resolution: d.resolution
        });

        return await withTransaction(async tx => {
          let unresolvedBefore = await tx.skillMergeRequestItem.count({
            where: {
              skillMergeRequestOid: mergeRequest.oid,
              status: 'unresolved'
            }
          });
          let updated = await tx.skillMergeRequestItem.update({
            where: {
              id: item.id
            },
            data: {
              status: skillMergeRequestInternalService.getResolutionStatus(d.resolutionType),
              resolutionType: d.resolutionType,
              resolution: d.resolution ?? Prisma.JsonNull,
              resolvedByTenantActorOid: access.actor?.oid,
              resolvedAt: new Date()
            },
            include: skillMergeRequestItemInclude
          });
          let unresolvedAfter = await tx.skillMergeRequestItem.count({
            where: {
              skillMergeRequestOid: mergeRequest.oid,
              status: 'unresolved'
            }
          });
          if (unresolvedBefore > 0 && unresolvedAfter === 0) {
            await skillMergeRequestEventService.createEvent({
              database: tx,
              mergeRequestOid: mergeRequest.oid,
              type: 'all_conflicts_resolved',
              actorOid: access.actor?.oid
            });
          }
          return updated;
        });
      }
    );
  }

  async bulkSaveSkillMergeRequestItemResolutions(
    d: CargoTenantEnvironment & {
      mergeRequest: SkillMergeRequestRecord;
      actorId?: string;
      items: {
        itemId: string;
        resolutionType: SkillMergeRequestResolutionType;
        resolution?: Prisma.InputJsonValue | null;
      }[];
    }
  ) {
    if (new Set(d.items.map(item => item.itemId)).size !== d.items.length) {
      throw new ServiceError(
        badRequestError({ message: 'Merge request item IDs must be unique' })
      );
    }

    return await skillMergeTargetLock.usingLock(
      d.mergeRequest.targetSkill.store.id,
      async () => {
        let mergeRequest = await skillMergeRequestInternalService.getRawSkillMergeRequestById({
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          skillMergeRequestId: d.mergeRequest.id
        });
        if (mergeRequest.status !== 'open') {
          throw new ServiceError(
            badRequestError({ message: 'Only open merge requests can change' })
          );
        }

        let access = await skillMergeRequestInternalService.assertTargetWrite({
          tenant: d.tenant,
          environment: d.environment,
          mergeRequest,
          actorId: d.actorId
        });
        let items = await Promise.all(
          d.items.map(async input => ({
            input,
            item: await skillMergeRequestInternalService.getSkillMergeRequestItemById({
              mergeRequest,
              itemId: input.itemId
            })
          }))
        );
        await Promise.all(
          items.map(({ item, input }) =>
            skillMergeRequestInternalService.validateItemResolution({
              tenant: d.tenant,
              environment: d.environment,
              mergeRequest,
              item,
              actorId: d.actorId,
              resolutionType: input.resolutionType,
              resolution: input.resolution
            })
          )
        );

        return await withTransaction(async tx => {
          let unresolvedBefore = await tx.skillMergeRequestItem.count({
            where: {
              skillMergeRequestOid: mergeRequest.oid,
              status: 'unresolved'
            }
          });
          for (let { item, input } of items) {
            await tx.skillMergeRequestItem.update({
              where: { id: item.id },
              data: {
                status: skillMergeRequestInternalService.getResolutionStatus(
                  input.resolutionType
                ),
                resolutionType: input.resolutionType,
                resolution: input.resolution ?? Prisma.JsonNull,
                resolvedByTenantActorOid: access.actor?.oid,
                resolvedAt: new Date()
              }
            });
          }

          let unresolvedAfter = await tx.skillMergeRequestItem.count({
            where: {
              skillMergeRequestOid: mergeRequest.oid,
              status: 'unresolved'
            }
          });
          if (unresolvedBefore > 0 && unresolvedAfter === 0) {
            await skillMergeRequestEventService.createEvent({
              database: tx,
              mergeRequestOid: mergeRequest.oid,
              type: 'all_conflicts_resolved',
              actorOid: access.actor?.oid
            });
          }

          return await tx.skillMergeRequestItem.findMany({
            where: { id: { in: items.map(({ item }) => item.id) } },
            include: skillMergeRequestItemInclude
          });
        });
      }
    );
  }

  async performSkillMergeRequest(
    d: CargoTenantEnvironment & {
      mergeRequest: SkillMergeRequestRecord;
      actorId?: string;
    }
  ) {
    if (d.mergeRequest.status !== 'open') {
      throw new ServiceError(
        badRequestError({ message: 'Only open merge requests can merge' })
      );
    }

    let access = await skillMergeRequestInternalService.assertTargetWrite({
      tenant: d.tenant,
      environment: d.environment,
      mergeRequest: d.mergeRequest,
      actorId: d.actorId
    });

    let updated = await skillMergeTargetLock.usingLock(
      d.mergeRequest.targetSkill.store.id,
      async () =>
        await withTransaction(async tx => {
          let updated = await tx.skillMergeRequest.updateMany({
            where: {
              oid: d.mergeRequest.oid,
              status: 'open'
            },
            data: {
              status: 'merging',
              mergeError: null,
              mergeErrorCode: null,
              mergeStartedAt: new Date(),
              mergeStartedByTenantActorOid: access.actor?.oid
            }
          });

          if (updated.count !== 1) {
            throw new ServiceError(
              badRequestError({ message: 'Merge request is no longer open' })
            );
          }

          await skillMergeRequestEventService.createEvent({
            database: tx,
            mergeRequestOid: d.mergeRequest.oid,
            type: 'merge_started',
            actorOid: access.actor?.oid
          });

          return (await tx.skillMergeRequest.findUnique({
            where: {
              id: d.mergeRequest.id
            },
            include: skillMergeRequestInclude
          }))!;
        })
    );

    try {
      await enqueueSkillMergeRequestPerform({ skillMergeRequestId: updated.id });
      await db.skillForkSync.updateMany({
        where: {
          generatedMergeRequestOid: updated.oid,
          status: 'action_required'
        },
        data: {
          status: 'processing',
          error: null,
          actionRequiredAt: null
        }
      });
    } catch (err) {
      let mergeError = createSkillMergeRequestMergeError('enqueue_failed', err);
      await withTransaction(async tx => {
        let reset = await tx.skillMergeRequest.updateMany({
          where: {
            oid: updated.oid,
            status: 'merging'
          },
          data: {
            status: 'open',
            mergeStartedAt: null,
            mergeErrorCode: mergeError.code,
            mergeError: mergeError.message
          }
        });
        if (reset.count === 1) {
          await tx.skillForkSync.updateMany({
            where: {
              generatedMergeRequestOid: updated.oid,
              status: {
                in: ['pending', 'processing', 'action_required']
              }
            },
            data: {
              status: 'action_required',
              error: mergeError.message,
              actionRequiredAt: new Date()
            }
          });
          await skillMergeRequestEventService.createEvent({
            database: tx,
            mergeRequestOid: updated.oid,
            type: 'merge_failed',
            actorOid: access.actor?.oid,
            errorCode: mergeError.code,
            errorMessage: mergeError.message
          });
        }
      });
      throw mergeError;
    }

    return updated;
  }

  async closeSkillMergeRequest(
    d: CargoTenantEnvironment & {
      mergeRequest: SkillMergeRequestRecord;
      actorId?: string;
    }
  ) {
    let actor = d.actorId
      ? await actorService.getActorById({
          tenant: d.tenant,
          actorId: d.actorId
        })
      : undefined;

    return await skillMergeTargetLock.usingLock(
      d.mergeRequest.targetSkill.store.id,
      async () => {
        let mergeRequest = await skillMergeRequestInternalService.getRawSkillMergeRequestById({
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          skillMergeRequestId: d.mergeRequest.id
        });
        if (mergeRequest.status !== 'open') {
          throw new ServiceError(
            badRequestError({ message: 'Only open merge requests can close' })
          );
        }

        let canCloseAsRequester = await skillMergeRequestInternalService.canCloseAsRequester({
          mergeRequest,
          actorId: d.actorId
        });

        if (!canCloseAsRequester) {
          await skillMergeRequestInternalService.assertTargetWrite({
            tenant: d.tenant,
            environment: d.environment,
            mergeRequest,
            actorId: d.actorId
          });
        }

        return await withTransaction(async tx => {
          let closed = await tx.skillMergeRequest.update({
            where: {
              id: mergeRequest.id
            },
            data: {
              status: 'closed',
              activePairKey: null,
              closedAt: new Date(),
              closedByTenantActorOid: actor?.oid
            },
            include: skillMergeRequestInclude
          });
          await tx.skillForkSync.updateMany({
            where: {
              generatedMergeRequestOid: closed.oid,
              status: {
                in: ['pending', 'processing', 'action_required']
              }
            },
            data: {
              status: 'cancelled',
              activePairKey: null,
              cancelledAt: new Date()
            }
          });
          await skillMergeRequestEventService.createEvent({
            database: tx,
            mergeRequestOid: closed.oid,
            type: 'closed',
            actorOid: actor?.oid
          });
          return closed;
        });
      }
    );
  }

  async rollbackSkillMergeRequest(
    d: CargoTenantEnvironment & {
      mergeRequest: SkillMergeRequestRecord;
      actorId?: string;
    }
  ) {
    return await skillMergeRequestApplyInternalService.rollbackSkillMergeRequest(d);
  }
}

export let skillMergeRequestService = Service.create(
  'cargoSkillMergeRequestService',
  () => new SkillMergeRequestServiceImpl()
).build();
