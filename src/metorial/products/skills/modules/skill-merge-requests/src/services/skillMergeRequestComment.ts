import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { assertResourceActorScope } from '@metorial/module-access';
import type { Instance, Project, ResourceActor } from '@metorial/db';
import { db, ID, withTransaction } from '@metorial/db';
import { skillMergeRequestEventService } from './skillMergeRequestEvent';
import {
  skillMergeRequestCommentInclude,
  skillMergeRequestInternalService,
  type SkillMergeRequestCommentRecord,
  type SkillMergeRequestRecord
} from '../internal/skillMergeRequestInternal';

class SkillMergeRequestCommentServiceImpl {
  async getSkillMergeRequestCommentById(d: {
    mergeRequest: Pick<SkillMergeRequestRecord, 'oid'>;
    commentId: string;
    includeDeleted?: boolean;
  }) {
    let comment = await db.skillMergeRequestComment.findFirst({
      where: {
        id: d.commentId,
        skillMergeRequestOid: d.mergeRequest.oid,
        deletedAt: d.includeDeleted ? undefined : null
      },
      include: skillMergeRequestCommentInclude
    });

    if (!comment) {
      throw new ServiceError(notFoundError('skill.mergeRequest.comment', d.commentId));
    }

    return comment;
  }

  async listComments(d: {
    project: Project;
    instance: Instance;
    mergeRequest: SkillMergeRequestRecord;
    itemId?: string;
  }) {
    let item = d.itemId
      ? await skillMergeRequestInternalService.getSkillMergeRequestItemById({
          mergeRequest: d.mergeRequest,
          itemId: d.itemId
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.skillMergeRequestComment.findMany({
          ...opts,
          where: {
            skillMergeRequestOid: d.mergeRequest.oid,
            skillMergeRequestItemOid: item?.oid,
            deletedAt: null
          },
          include: skillMergeRequestCommentInclude,
          orderBy: {
            createdAt: 'asc'
          }
        })
      )
    );
  }

  async createComment(d: {
    project: Project;
    instance: Instance;
    mergeRequest: SkillMergeRequestRecord;
    itemId?: string;
    inReplyToCommentId?: string;
    actor: ResourceActor;
    body: string;
    path?: string | null;
  }) {
    assertResourceActorScope({
      project: d.project,
      resourceActor: d.actor
    });
    if (!d.body.trim()) {
      throw new ServiceError(badRequestError({ message: 'Comment body cannot be empty' }));
    }

    let actor = d.actor;
    let item = d.itemId
      ? await skillMergeRequestInternalService.getSkillMergeRequestItemById({
          mergeRequest: d.mergeRequest,
          itemId: d.itemId
        })
      : undefined;
    let reply = d.inReplyToCommentId
      ? await this.getSkillMergeRequestCommentById({
          mergeRequest: d.mergeRequest,
          commentId: d.inReplyToCommentId
        })
      : undefined;
    let skillMergeRequestItemOid = item?.oid ?? reply?.skillMergeRequestItemOid ?? null;
    let path = d.path ?? item?.path ?? reply?.path ?? null;

    if (reply && reply.skillMergeRequestItemOid !== skillMergeRequestItemOid) {
      throw new ServiceError(
        badRequestError({ message: 'Replies must belong to the same merge request item' })
      );
    }
    if (reply && reply.path !== path) {
      throw new ServiceError(
        badRequestError({ message: 'Replies must use the same path as the parent comment' })
      );
    }
    if (item && path !== item.path) {
      throw new ServiceError(
        badRequestError({ message: 'Comment path must match the selected merge request item' })
      );
    }
    if (!item && path) {
      let matchingItem = await db.skillMergeRequestItem.findFirst({
        where: {
          skillMergeRequestOid: d.mergeRequest.oid,
          path
        },
        select: { oid: true }
      });
      if (!matchingItem) {
        throw new ServiceError(
          badRequestError({ message: 'Comment path must match a merge request item' })
        );
      }
    }

    return await withTransaction(async tx => {
      let comment = await tx.skillMergeRequestComment.create({
        data: {
          id: await ID.generateId('skillMergeRequestComment'),
          skillMergeRequestOid: d.mergeRequest.oid,
          skillMergeRequestItemOid,
          inReplyToCommentOid: reply?.oid,
          resourceActorOid: actor.oid,
          body: d.body,
          path
        },
        include: skillMergeRequestCommentInclude
      });
      await skillMergeRequestEventService.createEvent({
        database: tx,
        mergeRequestOid: d.mergeRequest.oid,
        type: 'commented',
        actorOid: actor.oid,
        commentOid: comment.oid
      });
      return comment;
    });
  }

  async updateComment(d: {
    project: Project;
    instance: Instance;
    mergeRequest: SkillMergeRequestRecord;
    comment: SkillMergeRequestCommentRecord;
    actor: ResourceActor;
    body: string;
    canManageComments?: boolean;
  }) {
    assertResourceActorScope({
      project: d.project,
      resourceActor: d.actor
    });
    if (!d.body.trim()) {
      throw new ServiceError(badRequestError({ message: 'Comment body cannot be empty' }));
    }

    let actor = d.actor;
    let canManageComment =
      d.comment.resourceActorOid === actor.oid ||
      (d.canManageComments === true && actor.organizationActorOid != null);
    if (!canManageComment) {
      throw new ServiceError(forbiddenError({ message: 'Cannot edit another actor comment' }));
    }

    return await db.skillMergeRequestComment.update({
      where: {
        id: d.comment.id
      },
      data: {
        body: d.body
      },
      include: skillMergeRequestCommentInclude
    });
  }

  async deleteComment(d: {
    project: Project;
    instance: Instance;
    mergeRequest: SkillMergeRequestRecord;
    comment: SkillMergeRequestCommentRecord;
    actor: ResourceActor;
    canManageComments?: boolean;
  }) {
    assertResourceActorScope({
      project: d.project,
      resourceActor: d.actor
    });
    let actor = d.actor;
    let canManageComment =
      d.comment.resourceActorOid === actor.oid ||
      (d.canManageComments === true && actor.organizationActorOid != null);
    if (!canManageComment) {
      throw new ServiceError(
        forbiddenError({ message: 'Cannot delete another actor comment' })
      );
    }

    return await db.skillMergeRequestComment.update({
      where: {
        id: d.comment.id
      },
      data: {
        deletedAt: new Date()
      },
      include: skillMergeRequestCommentInclude
    });
  }
}

export let skillMergeRequestCommentService = Service.create(
  'cargoSkillMergeRequestCommentService',
  () => new SkillMergeRequestCommentServiceImpl()
).build();
