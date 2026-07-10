import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillMergeRequestService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import {
  skillMergePlanPresenter,
  skillMergeRequestCommentPresenter,
  skillMergeRequestItemPresenter,
  skillMergeRequestPresenter
} from '../../../presenters';

let readScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let writeScopes = ['instance.skill:write', 'consumer#instance.skill:write'] as const;
let commentManagementScopes = ['instance.skill:write'] as const;
let statusValidator = v.enumOf(['open', 'closed', 'merging', 'merged']);
let resolutionTypeValidator = v.enumOf([
  'accept_source',
  'keep_target',
  'remove',
  'edit_document',
  'replace_file',
  'skip'
]);
let resolutionValidator = v.optional(
  v.nullable(
    v.object({
      title: v.optional(v.string()),
      content: v.optional(v.string()),
      fileId: v.optional(v.string())
    })
  )
);

let getAccess = (ctx: any) => ({
  owner: {
    type: 'instance' as const,
    instance: ctx.instance,
    organization: ctx.organization
  },
  ...getInstanceCargoAccess(ctx)
});

export let skillMergeRequestGroup = instanceGroup
  .use(hasFlags(['skills-enabled']))
  .use(async ctx => {
    if (!ctx.params.skillMergeRequestId) {
      throw new ServiceError(
        badRequestError({
          message: 'skillMergeRequestId is required',
          description: 'The skillMergeRequestId path parameter is required.'
        })
      );
    }

    let skillMergeRequest = await skillMergeRequestService.getSkillMergeRequestById({
      ...getAccess(ctx),
      skillMergeRequestId: ctx.params.skillMergeRequestId
    });

    return { skillMergeRequest };
  });

export let skillMergeRequestController = Controller.create(
  {
    name: 'Skill Merge Requests',
    description: 'Review, resolve, and apply changes between skills.'
  },
  {
    list: instanceGroup
      .get(instancePath('skill-merge-requests', 'skills.mergeRequests.list'), {
        name: 'List skill merge requests',
        description: 'Returns a paginated list of skill merge requests.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .outputList(skillMergeRequestPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            source_skill_id: v.optional(v.union([v.string(), v.array(v.string())])),
            target_skill_id: v.optional(v.union([v.string(), v.array(v.string())])),
            status: v.optional(v.union([statusValidator, v.array(statusValidator)])),
            created_by_actor_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('skill merge request creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await skillMergeRequestService.listSkillMergeRequests({
          ...getAccess(ctx),
          ids: normalizeArrayParam(ctx.query.id),
          sourceSkillIds: normalizeArrayParam(ctx.query.source_skill_id),
          targetSkillIds: normalizeArrayParam(ctx.query.target_skill_id),
          statuses: normalizeArrayParam(ctx.query.status),
          createdByActorIds: normalizeArrayParam(ctx.query.created_by_actor_id),
          createdAt: ctx.query.created_at
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillMergeRequest =>
          skillMergeRequestPresenter.present({ skillMergeRequest })
        );
      }),

    create: instanceGroup
      .post(instancePath('skill-merge-requests', 'skills.mergeRequests.create'), {
        name: 'Create skill merge request',
        description: 'Creates a merge request from one skill into another.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body(
        'default',
        v.object({
          source_skill_id: v.string(),
          target_skill_id: v.optional(v.string()),
          title: v.string(),
          description: v.optional(v.nullable(v.string()))
        })
      )
      .output(skillMergeRequestPresenter)
      .do(async ctx => {
        let skillMergeRequest = await skillMergeRequestService.createSkillMergeRequest({
          ...getAccess(ctx),
          sourceSkillId: ctx.body.source_skill_id,
          targetSkillId: ctx.body.target_skill_id,
          title: ctx.body.title,
          description: ctx.body.description
        });

        return skillMergeRequestPresenter.present({ skillMergeRequest });
      }),

    get: skillMergeRequestGroup
      .get(
        instancePath('skill-merge-requests/:skillMergeRequestId', 'skills.mergeRequests.get'),
        {
          name: 'Get skill merge request',
          description: 'Retrieves a skill merge request.'
        }
      )
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .output(skillMergeRequestPresenter)
      .do(async ctx =>
        skillMergeRequestPresenter.present({ skillMergeRequest: ctx.skillMergeRequest })
      ),

    getPlan: skillMergeRequestGroup
      .get(
        instancePath(
          'skill-merge-requests/:skillMergeRequestId/plan',
          'skills.mergeRequests.plan.get'
        ),
        {
          name: 'Get skill merge plan',
          description: 'Returns the proposed changes and conflicts for a skill merge request.'
        }
      )
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .output(skillMergePlanPresenter)
      .do(async ctx => {
        let skillMergePlan = await skillMergeRequestService.getSkillMergePlan({
          ...getAccess(ctx),
          skillMergeRequestId: ctx.skillMergeRequest.id
        });

        return skillMergePlanPresenter.present({ skillMergePlan });
      }),

    resolveItem: skillMergeRequestGroup
      .patch(
        instancePath(
          'skill-merge-requests/:skillMergeRequestId/items/:itemId',
          'skills.mergeRequests.items.resolve'
        ),
        {
          name: 'Resolve skill merge request item',
          description: 'Saves a resolution for one proposed skill change.'
        }
      )
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body(
        'default',
        v.object({
          resolution_type: resolutionTypeValidator,
          resolution: resolutionValidator
        })
      )
      .output(skillMergeRequestItemPresenter)
      .do(async ctx => {
        let skillMergeRequestItem =
          await skillMergeRequestService.resolveSkillMergeRequestItem({
            ...getAccess(ctx),
            skillMergeRequestId: ctx.skillMergeRequest.id,
            itemId: ctx.params.itemId,
            resolutionType: ctx.body.resolution_type,
            resolution: ctx.body.resolution
          });

        return skillMergeRequestItemPresenter.present({ skillMergeRequestItem });
      }),

    bulkResolveItems: skillMergeRequestGroup
      .patch(
        instancePath(
          'skill-merge-requests/:skillMergeRequestId/items',
          'skills.mergeRequests.items.bulkResolve'
        ),
        {
          name: 'Resolve skill merge request items',
          description: 'Saves resolutions for multiple proposed skill changes.'
        }
      )
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body(
        'default',
        v.object({
          items: v.array(
            v.object({
              item_id: v.string(),
              resolution_type: resolutionTypeValidator,
              resolution: resolutionValidator
            })
          )
        })
      )
      .outputList(skillMergeRequestItemPresenter)
      .do(async ctx => {
        let items = await skillMergeRequestService.bulkResolveSkillMergeRequestItems({
          ...getAccess(ctx),
          skillMergeRequestId: ctx.skillMergeRequest.id,
          items: ctx.body.items.map(item => ({
            itemId: item.item_id,
            resolutionType: item.resolution_type,
            resolution: item.resolution
          }))
        });

        return Paginator.present(
          {
            items,
            pagination: {
              hasNextPage: false,
              hasPreviousPage: false
            }
          },
          skillMergeRequestItem =>
            skillMergeRequestItemPresenter.present({ skillMergeRequestItem })
        );
      }),

    perform: skillMergeRequestGroup
      .post(
        instancePath(
          'skill-merge-requests/:skillMergeRequestId/perform',
          'skills.mergeRequests.perform'
        ),
        {
          name: 'Perform skill merge request',
          description: 'Queues application of a resolved skill merge request.'
        }
      )
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .output(skillMergeRequestPresenter)
      .do(async ctx => {
        let skillMergeRequest = await skillMergeRequestService.performSkillMergeRequest({
          ...getAccess(ctx),
          skillMergeRequestId: ctx.skillMergeRequest.id
        });

        return skillMergeRequestPresenter.present({ skillMergeRequest });
      }),

    close: skillMergeRequestGroup
      .post(
        instancePath(
          'skill-merge-requests/:skillMergeRequestId/close',
          'skills.mergeRequests.close'
        ),
        {
          name: 'Close skill merge request',
          description: 'Closes an open skill merge request without applying it.'
        }
      )
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .output(skillMergeRequestPresenter)
      .do(async ctx => {
        let skillMergeRequest = await skillMergeRequestService.closeSkillMergeRequest({
          ...getAccess(ctx),
          skillMergeRequestId: ctx.skillMergeRequest.id
        });

        return skillMergeRequestPresenter.present({ skillMergeRequest });
      }),

    rollback: skillMergeRequestGroup
      .post(
        instancePath(
          'skill-merge-requests/:skillMergeRequestId/rollback',
          'skills.mergeRequests.rollback'
        ),
        {
          name: 'Rollback skill merge request',
          description: 'Restores the target skill to its state before a completed merge.'
        }
      )
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .output(skillMergeRequestPresenter)
      .do(async ctx => {
        let skillMergeRequest = await skillMergeRequestService.rollbackSkillMergeRequest({
          ...getAccess(ctx),
          skillMergeRequestId: ctx.skillMergeRequest.id
        });

        return skillMergeRequestPresenter.present({ skillMergeRequest });
      }),

    listComments: skillMergeRequestGroup
      .get(
        instancePath(
          'skill-merge-requests/:skillMergeRequestId/comments',
          'skills.mergeRequests.comments.list'
        ),
        {
          name: 'List skill merge request comments',
          description: 'Lists comments on a skill merge request or one of its items.'
        }
      )
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .outputList(skillMergeRequestCommentPresenter)
      .query('default', Paginator.validate(v.object({ item_id: v.optional(v.string()) })))
      .do(async ctx => {
        let paginator = await skillMergeRequestService.listSkillMergeRequestComments({
          ...getAccess(ctx),
          skillMergeRequestId: ctx.skillMergeRequest.id,
          skillMergeRequestItemId: ctx.query.item_id
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillMergeRequestComment =>
          skillMergeRequestCommentPresenter.present({ skillMergeRequestComment })
        );
      }),

    createComment: skillMergeRequestGroup
      .post(
        instancePath(
          'skill-merge-requests/:skillMergeRequestId/comments',
          'skills.mergeRequests.comments.create'
        ),
        {
          name: 'Create skill merge request comment',
          description: 'Adds a comment to a skill merge request or one of its items.'
        }
      )
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body(
        'default',
        v.object({
          item_id: v.optional(v.string()),
          in_reply_to_comment_id: v.optional(v.string()),
          body: v.string(),
          path: v.optional(v.nullable(v.string()))
        })
      )
      .output(skillMergeRequestCommentPresenter)
      .do(async ctx => {
        let skillMergeRequestComment =
          await skillMergeRequestService.createSkillMergeRequestComment({
            ...getAccess(ctx),
            skillMergeRequestId: ctx.skillMergeRequest.id,
            skillMergeRequestItemId: ctx.body.item_id,
            inReplyToCommentId: ctx.body.in_reply_to_comment_id,
            body: ctx.body.body,
            path: ctx.body.path
          });

        return skillMergeRequestCommentPresenter.present({ skillMergeRequestComment });
      }),

    getComment: skillMergeRequestGroup
      .get(
        instancePath(
          'skill-merge-requests/:skillMergeRequestId/comments/:commentId',
          'skills.mergeRequests.comments.get'
        ),
        {
          name: 'Get skill merge request comment',
          description: 'Retrieves a comment on a skill merge request.'
        }
      )
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .output(skillMergeRequestCommentPresenter)
      .do(async ctx => {
        let skillMergeRequestComment =
          await skillMergeRequestService.getSkillMergeRequestCommentById({
            ...getAccess(ctx),
            skillMergeRequestId: ctx.skillMergeRequest.id,
            commentId: ctx.params.commentId
          });

        return skillMergeRequestCommentPresenter.present({ skillMergeRequestComment });
      }),

    updateComment: skillMergeRequestGroup
      .patch(
        instancePath(
          'skill-merge-requests/:skillMergeRequestId/comments/:commentId',
          'skills.mergeRequests.comments.update'
        ),
        {
          name: 'Update skill merge request comment',
          description: 'Updates a comment authored by the current actor.'
        }
      )
      .use(checkAccess({ possibleScopes: [...commentManagementScopes] }))
      .body('default', v.object({ body: v.string() }))
      .output(skillMergeRequestCommentPresenter)
      .do(async ctx => {
        let skillMergeRequestComment =
          await skillMergeRequestService.updateSkillMergeRequestComment({
            ...getAccess(ctx),
            skillMergeRequestId: ctx.skillMergeRequest.id,
            commentId: ctx.params.commentId,
            body: ctx.body.body
          });

        return skillMergeRequestCommentPresenter.present({ skillMergeRequestComment });
      }),

    deleteComment: skillMergeRequestGroup
      .delete(
        instancePath(
          'skill-merge-requests/:skillMergeRequestId/comments/:commentId',
          'skills.mergeRequests.comments.delete'
        ),
        {
          name: 'Delete skill merge request comment',
          description: 'Deletes a comment authored by the current actor.'
        }
      )
      .use(checkAccess({ possibleScopes: [...commentManagementScopes] }))
      .output(skillMergeRequestCommentPresenter)
      .do(async ctx => {
        let skillMergeRequestComment =
          await skillMergeRequestService.deleteSkillMergeRequestComment({
            ...getAccess(ctx),
            skillMergeRequestId: ctx.skillMergeRequest.id,
            commentId: ctx.params.commentId
          });

        return skillMergeRequestCommentPresenter.present({ skillMergeRequestComment });
      })
  }
);
