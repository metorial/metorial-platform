import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  skillMergeRequestCommentService,
  skillMergeRequestEventService,
  skillMergeRequestService
} from '@metorial-cargo/module-skill';
import {
  skillMergePlanPresenter,
  skillMergeRequestCommentPresenter,
  skillMergeRequestEventPresenter,
  skillMergeRequestItemPresenter,
  skillMergeRequestPresenter
} from '../presenters';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';
import { tenantApp } from './tenant';

let mergeRequestStatusSchema = v.enumOf(['open', 'closed', 'merging', 'merged']);
let mergeRequestResolutionTypeSchema = v.enumOf([
  'accept_source',
  'keep_target',
  'remove',
  'edit_document',
  'replace_file',
  'skip'
]);
let mergeRequestEventTypeSchema = v.enumOf([
  'created',
  'commented',
  'all_conflicts_resolved',
  'merge_started',
  'merge_completed',
  'merge_failed',
  'closed',
  'rolled_back'
]);
let resolutionSchema = v.optional(
  v.nullable(
    v.object({
      title: v.optional(v.string()),
      content: v.optional(v.string()),
      fileId: v.optional(v.string())
    })
  )
);

export let skillMergeRequestApp = tenantApp.use(async ctx => {
  let skillMergeRequestId = ctx.body.skillMergeRequestId;
  if (!skillMergeRequestId) throw new Error('Skill merge request ID is required');

  let skillMergeRequest = await skillMergeRequestService.getSkillMergeRequestById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    skillMergeRequestId,
    actorId: ctx.body.actorId
  });

  return { skillMergeRequest };
});

export let skillMergeRequestCommentApp = skillMergeRequestApp.use(async ctx => {
  let commentId = ctx.body.commentId;
  if (!commentId) throw new Error('Skill merge request comment ID is required');

  let comment = await skillMergeRequestCommentService.getSkillMergeRequestCommentById({
    mergeRequest: ctx.skillMergeRequest,
    commentId
  });

  return { comment };
});

let commentController = app.controller({
  list: skillMergeRequestApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          skillMergeRequestId: v.string(),
          skillMergeRequestItemId: v.optional(v.string()),
          actorId: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillMergeRequestCommentService.listComments({
        tenant: ctx.tenant,
        environment: ctx.environment,
        mergeRequest: ctx.skillMergeRequest,
        itemId: ctx.input.skillMergeRequestItemId
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, skillMergeRequestCommentPresenter);
    }),

  get: skillMergeRequestCommentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMergeRequestId: v.string(),
        commentId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx => skillMergeRequestCommentPresenter(ctx.comment)),

  create: skillMergeRequestApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMergeRequestId: v.string(),
        skillMergeRequestItemId: v.optional(v.string()),
        inReplyToCommentId: v.optional(v.string()),
        actorId: v.string(),
        body: v.string(),
        path: v.optional(v.nullable(v.string()))
      })
    )
    .do(async ctx =>
      skillMergeRequestCommentPresenter(
        await skillMergeRequestCommentService.createComment({
          tenant: ctx.tenant,
          environment: ctx.environment,
          mergeRequest: ctx.skillMergeRequest,
          itemId: ctx.input.skillMergeRequestItemId,
          inReplyToCommentId: ctx.input.inReplyToCommentId,
          actorId: ctx.input.actorId,
          body: ctx.input.body,
          path: ctx.input.path
        })
      )
    ),

  update: skillMergeRequestCommentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMergeRequestId: v.string(),
        commentId: v.string(),
        actorId: v.string(),
        body: v.string(),
        canManageComments: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      skillMergeRequestCommentPresenter(
        await skillMergeRequestCommentService.updateComment({
          tenant: ctx.tenant,
          environment: ctx.environment,
          mergeRequest: ctx.skillMergeRequest,
          comment: ctx.comment,
          actorId: ctx.input.actorId,
          body: ctx.input.body,
          canManageComments: ctx.input.canManageComments
        })
      )
    ),

  delete: skillMergeRequestCommentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMergeRequestId: v.string(),
        commentId: v.string(),
        actorId: v.string(),
        canManageComments: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      skillMergeRequestCommentPresenter(
        await skillMergeRequestCommentService.deleteComment({
          tenant: ctx.tenant,
          environment: ctx.environment,
          mergeRequest: ctx.skillMergeRequest,
          comment: ctx.comment,
          actorId: ctx.input.actorId,
          canManageComments: ctx.input.canManageComments
        })
      )
    )
});

let eventController = app.controller({
  list: skillMergeRequestApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          skillMergeRequestId: v.string(),
          actorId: v.optional(v.string()),
          types: v.optional(v.array(mergeRequestEventTypeSchema)),
          createdAt: dateFilterSchema
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillMergeRequestEventService.listEvents({
        tenant: ctx.tenant,
        environment: ctx.environment,
        mergeRequest: ctx.skillMergeRequest,
        actorId: ctx.input.actorId,
        types: ctx.input.types,
        createdAt: ctx.input.createdAt
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, skillMergeRequestEventPresenter);
    }),

  get: skillMergeRequestApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMergeRequestId: v.string(),
        eventId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx =>
      skillMergeRequestEventPresenter(
        await skillMergeRequestEventService.getEventById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          mergeRequest: ctx.skillMergeRequest,
          eventId: ctx.input.eventId,
          actorId: ctx.input.actorId
        })
      )
    )
});

export let skillMergeRequestController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sourceSkillId: v.string(),
        targetSkillId: v.optional(v.string()),
        actorId: v.optional(v.string()),
        title: v.string(),
        description: v.optional(v.nullable(v.string()))
      })
    )
    .do(async ctx =>
      skillMergeRequestPresenter(
        await skillMergeRequestService.createSkillMergeRequest({
          tenant: ctx.tenant,
          environment: ctx.environment,
          sourceSkillId: ctx.input.sourceSkillId,
          targetSkillId: ctx.input.targetSkillId,
          actorId: ctx.input.actorId,
          title: ctx.input.title,
          description: ctx.input.description
        })
      )
    ),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          skillMergeRequestIds: v.optional(v.array(v.string())),
          sourceSkillIds: v.optional(v.array(v.string())),
          targetSkillIds: v.optional(v.array(v.string())),
          statuses: v.optional(v.array(mergeRequestStatusSchema)),
          createdByActorIds: v.optional(v.array(v.string())),
          createdAt: dateFilterSchema,
          actorId: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillMergeRequestService.listSkillMergeRequests({
        tenant: ctx.tenant,
        environment: ctx.environment,
        ids: ctx.input.skillMergeRequestIds,
        sourceSkillIds: ctx.input.sourceSkillIds,
        targetSkillIds: ctx.input.targetSkillIds,
        statuses: ctx.input.statuses,
        createdByActorIds: ctx.input.createdByActorIds,
        createdAt: ctx.input.createdAt,
        actorId: ctx.input.actorId
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, skillMergeRequestPresenter);
    }),

  get: skillMergeRequestApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMergeRequestId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx => skillMergeRequestPresenter(ctx.skillMergeRequest)),

  getPlan: skillMergeRequestApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMergeRequestId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx =>
      skillMergePlanPresenter(
        await skillMergeRequestService.getSkillMergePlan({
          mergeRequest: ctx.skillMergeRequest
        })
      )
    ),

  resolveItem: skillMergeRequestApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMergeRequestId: v.string(),
        itemId: v.string(),
        actorId: v.optional(v.string()),
        resolutionType: mergeRequestResolutionTypeSchema,
        resolution: resolutionSchema
      })
    )
    .do(async ctx =>
      skillMergeRequestItemPresenter(
        await skillMergeRequestService.saveSkillMergeRequestItemResolution({
          tenant: ctx.tenant,
          environment: ctx.environment,
          mergeRequest: ctx.skillMergeRequest,
          itemId: ctx.input.itemId,
          actorId: ctx.input.actorId,
          resolutionType: ctx.input.resolutionType,
          resolution: ctx.input.resolution
        })
      )
    ),

  bulkResolveItems: skillMergeRequestApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMergeRequestId: v.string(),
        actorId: v.optional(v.string()),
        items: v.array(
          v.object({
            itemId: v.string(),
            resolutionType: mergeRequestResolutionTypeSchema,
            resolution: resolutionSchema
          })
        )
      })
    )
    .do(async ctx =>
      (
        await skillMergeRequestService.bulkSaveSkillMergeRequestItemResolutions({
          tenant: ctx.tenant,
          environment: ctx.environment,
          mergeRequest: ctx.skillMergeRequest,
          actorId: ctx.input.actorId,
          items: ctx.input.items
        })
      ).map(skillMergeRequestItemPresenter)
    ),

  perform: skillMergeRequestApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMergeRequestId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx =>
      skillMergeRequestPresenter(
        await skillMergeRequestService.performSkillMergeRequest({
          tenant: ctx.tenant,
          environment: ctx.environment,
          mergeRequest: ctx.skillMergeRequest,
          actorId: ctx.input.actorId
        })
      )
    ),

  getMergeStatus: skillMergeRequestApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMergeRequestId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      return {
        object: 'cargo#skillMergeRequestMergeStatus',
        id: ctx.skillMergeRequest.id,
        status: ctx.skillMergeRequest.status,
        mergeError: ctx.skillMergeRequest.mergeError,
        mergeErrorCode: ctx.skillMergeRequest.mergeErrorCode,
        mergeStartedAt: ctx.skillMergeRequest.mergeStartedAt,
        mergedAt: ctx.skillMergeRequest.mergedAt
      };
    }),

  close: skillMergeRequestApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMergeRequestId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx =>
      skillMergeRequestPresenter(
        await skillMergeRequestService.closeSkillMergeRequest({
          tenant: ctx.tenant,
          environment: ctx.environment,
          mergeRequest: ctx.skillMergeRequest,
          actorId: ctx.input.actorId
        })
      )
    ),

  rollback: skillMergeRequestApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMergeRequestId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx =>
      skillMergeRequestPresenter(
        await skillMergeRequestService.rollbackSkillMergeRequest({
          tenant: ctx.tenant,
          environment: ctx.environment,
          mergeRequest: ctx.skillMergeRequest,
          actorId: ctx.input.actorId
        })
      )
    ),

  comment: commentController,
  event: eventController
});
