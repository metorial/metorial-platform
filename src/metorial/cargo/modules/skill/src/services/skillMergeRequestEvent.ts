import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import { type DateFilter, normalizeDateFilter } from '@metorial/cargo-list-utils';
import { resourceActorService } from '@metorial/module-resource-tenant';
import { type ResourceScope } from '@metorial/module-resource-tenant';
import { storeAccessService, storeReadPermission } from '@metorial/cargo-module-store';
import type { SkillMergeRequestEventType, TransactionDB } from '@metorial/db';
import { db, type Prisma } from '@metorial/db';
import type { SkillMergeRequestRecord } from './skillMergeRequestInternal';

export let skillMergeRequestEventInclude = {
  resourceActor: true,
  comment: {
    include: {
      skillMergeRequestItem: true,
      resourceActor: true,
      inReplyToComment: true
    }
  }
} satisfies Prisma.SkillMergeRequestEventInclude;

export type SkillMergeRequestEventRecord = Prisma.SkillMergeRequestEventGetPayload<{
  include: typeof skillMergeRequestEventInclude;
}>;

class SkillMergeRequestEventServiceImpl {
  async createEvent(d: {
    database?: TransactionDB;
    mergeRequestOid: bigint;
    type: SkillMergeRequestEventType;
    actorOid?: bigint | null;
    commentOid?: bigint | null;
    errorCode?: Prisma.SkillMergeRequestEventCreateInput['errorCode'];
    errorMessage?: string | null;
  }) {
    let database = d.database ?? db;
    let ids = getId('skillMergeRequestEvent');

    return await database.skillMergeRequestEvent.create({
      data: {
        oid: ids.oid,
        id: ids.id,
        type: d.type,
        skillMergeRequestOid: d.mergeRequestOid,
        resourceActorOid: d.actorOid,
        commentOid: d.commentOid,
        errorCode: d.errorCode,
        errorMessage: d.errorMessage
      },
      include: skillMergeRequestEventInclude
    });
  }

  private async assertReadAccess(
    d: ResourceScope & {
      mergeRequest: SkillMergeRequestRecord;
      actorId?: string;
    }
  ) {
    let actor = d.actorId
      ? await resourceActorService.getActorById({
          resourceTenant: d.resourceTenant!,
          actorId: d.actorId
        })
      : undefined;
    let readable = async (store: SkillMergeRequestRecord['sourceSkill']['store']) =>
      await storeAccessService.assertStoreAccessForStore({
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        store: store!,
        actorId: actor?.id,
        requiredPermission: storeReadPermission
      });

    try {
      await readable(d.mergeRequest.sourceSkill.store);
      return;
    } catch (err) {
      if (!actor) throw err;
    }

    await readable(d.mergeRequest.targetSkill.store);
  }

  async listEvents(
    d: ResourceScope & {
      mergeRequest: SkillMergeRequestRecord;
      actorId?: string;
      types?: SkillMergeRequestEventType[];
      createdAt?: DateFilter;
    }
  ) {
    await this.assertReadAccess(d);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.skillMergeRequestEvent.findMany({
          ...opts,
          where: {
            skillMergeRequestOid: d.mergeRequest.oid,
            type: d.types ? { in: d.types } : undefined,
            createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined
          },
          include: skillMergeRequestEventInclude,
          orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }]
        })
      )
    );
  }

  async getEventById(
    d: ResourceScope & {
      mergeRequest: SkillMergeRequestRecord;
      actorId?: string;
      eventId: string;
    }
  ) {
    await this.assertReadAccess(d);

    let event = await db.skillMergeRequestEvent.findFirst({
      where: {
        id: d.eventId,
        skillMergeRequestOid: d.mergeRequest.oid
      },
      include: skillMergeRequestEventInclude
    });

    if (!event) {
      throw new ServiceError(notFoundError('skill.mergeRequest.event', d.eventId));
    }

    return event;
  }
}

export let skillMergeRequestEventService = Service.create(
  'cargoSkillMergeRequestEventService',
  () => new SkillMergeRequestEventServiceImpl()
).build();
