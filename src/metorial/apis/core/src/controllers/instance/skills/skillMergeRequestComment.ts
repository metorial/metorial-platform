import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillMergeRequestCommentService } from '@metorial/module-skill-merge-requests';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { skillMergeRequestCommentPresenter } from '@metorial/presenters';
import {
  getSkillMergeRequestAccess,
  skillMergeRequestGroup,
  skillMergeRequestReadScopes,
  skillMergeRequestWriteScopes
} from './skillMergeRequest';

export let skillMergeRequestCommentController = Controller.create(
  {
    name: 'Skill Merge Request Comments',
    description: 'A skill merge request comment is a comment on a merge request or one of its proposed changes.',
    hideInDocs: true
  },
  {
    list: skillMergeRequestGroup
      .get(
        instancePath(
          'skill-merge-requests/:skillMergeRequestId/comments',
          'skills.mergeRequests.comments.list'
        ),
        {
          name: 'List skill merge request comments',
          description: 'Returns a paginated list of skill merge request comments.'
        }
      )
      .use(checkAccess({ possibleScopes: [...skillMergeRequestReadScopes] }))
      .outputList(skillMergeRequestCommentPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            item_id: v.optional(
              v.string({
                description: 'Only return comments on this proposed change.'
              })
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await skillMergeRequestCommentService.listComments({
          ...(await getSkillMergeRequestAccess(ctx)),
          mergeRequest: ctx.skillMergeRequest,
          itemId: ctx.query.item_id
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillMergeRequestComment =>
          skillMergeRequestCommentPresenter.present({ skillMergeRequestComment })
        );
      }),

    create: skillMergeRequestGroup
      .post(
        instancePath(
          'skill-merge-requests/:skillMergeRequestId/comments',
          'skills.mergeRequests.comments.create'
        ),
        {
          name: 'Create skill merge request comment',
          description: 'Creates a comment on a skill merge request or one of its items.'
        }
      )
      .use(checkAccess({ possibleScopes: [...skillMergeRequestWriteScopes] }))
      .body(
        'default',
        v.object({
          item_id: v.optional(
            v.string({
              description: 'Proposed change to comment on. Omit to comment on the merge request.'
            })
          ),
          in_reply_to_comment_id: v.optional(
            v.string({
              description: 'Comment this replies to, by ID.'
            })
          ),
          body: v.string({ description: 'Comment text.' }),
          path: v.optional(v.nullable(v.string()), {
            description: 'File path the comment refers to. `null` for general comments.'
          })
        })
      )
      .output(skillMergeRequestCommentPresenter)
      .do(async ctx => {
        let access = await getSkillMergeRequestAccess(ctx);
        let skillMergeRequestComment =
          await skillMergeRequestCommentService.createComment({
            ...access,
            mergeRequest: ctx.skillMergeRequest,
            itemId: ctx.body.item_id,
            inReplyToCommentId: ctx.body.in_reply_to_comment_id,
            actor: access.actor!,
            body: ctx.body.body,
            path: ctx.body.path
          });

        return skillMergeRequestCommentPresenter.present({ skillMergeRequestComment });
      }),

    get: skillMergeRequestGroup
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
      .use(checkAccess({ possibleScopes: [...skillMergeRequestReadScopes] }))
      .output(skillMergeRequestCommentPresenter)
      .do(async ctx => {
        let skillMergeRequestComment =
          await skillMergeRequestCommentService.getSkillMergeRequestCommentById({
            mergeRequest: ctx.skillMergeRequest,
            commentId: ctx.params.commentId
          });

        return skillMergeRequestCommentPresenter.present({ skillMergeRequestComment });
      }),

    update: skillMergeRequestGroup
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
      .use(checkAccess({ possibleScopes: [...skillMergeRequestWriteScopes] }))
      .body('default', v.object({ body: v.string({ description: 'Comment text.' }) }))
      .output(skillMergeRequestCommentPresenter)
      .do(async ctx => {
        let access = await getSkillMergeRequestAccess(ctx);
        let skillMergeRequestComment =
          await skillMergeRequestCommentService.updateComment({
            ...access,
            mergeRequest: ctx.skillMergeRequest,
            comment: await skillMergeRequestCommentService.getSkillMergeRequestCommentById({
              mergeRequest: ctx.skillMergeRequest,
              commentId: ctx.params.commentId
            }),
            actor: access.actor!,
            body: ctx.body.body,
            canManageComments: !!ctx.member?.actor
          });

        return skillMergeRequestCommentPresenter.present({ skillMergeRequestComment });
      }),

    delete: skillMergeRequestGroup
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
      .use(checkAccess({ possibleScopes: [...skillMergeRequestWriteScopes] }))
      .output(skillMergeRequestCommentPresenter)
      .do(async ctx => {
        let access = await getSkillMergeRequestAccess(ctx);
        let skillMergeRequestComment =
          await skillMergeRequestCommentService.deleteComment({
            ...access,
            mergeRequest: ctx.skillMergeRequest,
            comment: await skillMergeRequestCommentService.getSkillMergeRequestCommentById({
              mergeRequest: ctx.skillMergeRequest,
              commentId: ctx.params.commentId
            }),
            actor: access.actor!,
            canManageComments: !!ctx.member?.actor
          });

        return skillMergeRequestCommentPresenter.present({ skillMergeRequestComment });
      })
  }
);
