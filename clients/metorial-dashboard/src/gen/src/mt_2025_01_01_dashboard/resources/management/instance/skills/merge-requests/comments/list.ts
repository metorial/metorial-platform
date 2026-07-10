import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSkillsMergeRequestsCommentsListOutput = {
  items: {
    object: 'skill.merge_request.comment';
    id: string;
    skillMergeRequestItemId: string | null;
    actorId: string;
    body: string;
    path: string | null;
    inReplyToCommentId: string | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSkillsMergeRequestsCommentsListOutput =
  mtMap.object<ManagementInstanceSkillsMergeRequestsCommentsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          skillMergeRequestItemId: mtMap.objectField(
            'skill_merge_request_item_id',
            mtMap.passthrough()
          ),
          actorId: mtMap.objectField('actor_id', mtMap.passthrough()),
          body: mtMap.objectField('body', mtMap.passthrough()),
          path: mtMap.objectField('path', mtMap.passthrough()),
          inReplyToCommentId: mtMap.objectField(
            'in_reply_to_comment_id',
            mtMap.passthrough()
          ),
          deletedAt: mtMap.objectField('deleted_at', mtMap.date()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type ManagementInstanceSkillsMergeRequestsCommentsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { itemId?: string | undefined };

export let mapManagementInstanceSkillsMergeRequestsCommentsListQuery =
  mtMap.union([
    mtMap.unionOption(
      'object',
      mtMap.object({
        limit: mtMap.objectField('limit', mtMap.passthrough()),
        after: mtMap.objectField('after', mtMap.passthrough()),
        before: mtMap.objectField('before', mtMap.passthrough()),
        cursor: mtMap.objectField('cursor', mtMap.passthrough()),
        order: mtMap.objectField('order', mtMap.passthrough()),
        itemId: mtMap.objectField('item_id', mtMap.passthrough())
      })
    )
  ]);

