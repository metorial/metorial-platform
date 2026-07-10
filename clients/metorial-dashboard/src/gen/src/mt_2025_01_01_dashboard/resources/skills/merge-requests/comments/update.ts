import { mtMap } from '@metorial/util-resource-mapper';

export type SkillsMergeRequestsCommentsUpdateOutput = {
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

export let mapSkillsMergeRequestsCommentsUpdateOutput =
  mtMap.object<SkillsMergeRequestsCommentsUpdateOutput>({
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

export type SkillsMergeRequestsCommentsUpdateBody = { body: string };

export let mapSkillsMergeRequestsCommentsUpdateBody =
  mtMap.object<SkillsMergeRequestsCommentsUpdateBody>({
    body: mtMap.objectField('body', mtMap.passthrough())
  });

