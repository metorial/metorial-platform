import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSkillsMergeRequestsCommentsCreateOutput = {
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
};

export let mapManagementInstanceSkillsMergeRequestsCommentsCreateOutput =
  mtMap.object<ManagementInstanceSkillsMergeRequestsCommentsCreateOutput>({
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
  });

export type ManagementInstanceSkillsMergeRequestsCommentsCreateBody = {
  itemId?: string | undefined;
  inReplyToCommentId?: string | undefined;
  body: string;
  path?: string | null | undefined;
};

export let mapManagementInstanceSkillsMergeRequestsCommentsCreateBody =
  mtMap.object<ManagementInstanceSkillsMergeRequestsCommentsCreateBody>({
    itemId: mtMap.objectField('item_id', mtMap.passthrough()),
    inReplyToCommentId: mtMap.objectField(
      'in_reply_to_comment_id',
      mtMap.passthrough()
    ),
    body: mtMap.objectField('body', mtMap.passthrough()),
    path: mtMap.objectField('path', mtMap.passthrough())
  });

