import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import {
  skillMergePlanType,
  skillMergeRequestCommentType,
  skillMergeRequestEventType,
  skillMergeRequestItemType,
  skillMergeRequestType
} from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from '../files/documentParticipant';

let statusSchema = v.enumOf(['open', 'closed', 'merging', 'merged']);
let directionSchema = v.enumOf(['fork_to_upstream', 'upstream_to_fork']);
let errorCodeSchema = v.nullable(
  v.enumOf([
    'target_changed',
    'unresolved_after_refresh',
    'apply_failed',
    'verification_failed',
    'enqueue_failed',
    'stale_merge_recovered'
  ])
);
let baseStrategySchema = v.enumOf(['exact', 'inferred_created_at', 'inferred_current']);
let itemKindSchema = v.enumOf(['file', 'document', 'directory']);
let itemChangeTypeSchema = v.enumOf([
  'added',
  'modified',
  'removed',
  'unchanged',
  'conflicted'
]);
let itemStatusSchema = v.enumOf(['unresolved', 'resolved', 'skipped', 'applied']);
let resolutionTypeSchema = v.nullable(
  v.enumOf(['accept_source', 'keep_target', 'remove', 'edit_document', 'replace_file', 'skip'])
);
let eventTypeSchema = v.enumOf([
  'created',
  'commented',
  'all_conflicts_resolved',
  'merge_started',
  'merge_completed',
  'merge_failed',
  'closed',
  'rolled_back'
]);
let snapshotItemSchema = v.object({
  kind: itemKindSchema,
  path: v.string(),
  file_id: v.nullable(v.string()),
  document_id: v.nullable(v.string()),
  document_title: v.nullable(v.string()),
  document_version_id: v.nullable(v.string()),
  content: v.nullable(v.string())
});
let documentMergeSchema = v.object({
  base_content: v.nullable(v.string()),
  source_content: v.nullable(v.string()),
  target_content: v.nullable(v.string()),
  has_conflict: v.boolean()
});

let presentSnapshotItem = (item: {
  kind: 'file' | 'document' | 'directory';
  path: string;
  fileId?: string;
  documentId?: string;
  documentTitle?: string;
  documentVersionId?: string;
  content?: string;
}) => ({
  kind: item.kind,
  path: item.path,
  file_id: item.fileId ?? null,
  document_id: item.documentId ?? null,
  document_title: item.documentTitle ?? null,
  document_version_id: item.documentVersionId ?? null,
  content: item.content ?? null
});

export let v1SkillMergeRequestPresenter = Presenter.create(skillMergeRequestType)
  .presenter(async ({ skillMergeRequest }, opts) => ({
    object: 'skill.merge_request' as const,
    id: skillMergeRequest.id,
    status: skillMergeRequest.status,
    direction: skillMergeRequest.direction,
    base_strategy: skillMergeRequest.baseStrategy,
    title: skillMergeRequest.title,
    description: skillMergeRequest.description,
    merge_error: skillMergeRequest.mergeError,
    merge_error_code: skillMergeRequest.mergeErrorCode,
    source_skill_id: skillMergeRequest.sourceSkill.id,
    target_skill_id: skillMergeRequest.targetSkill.id,
    base_target_skill_version_id: skillMergeRequest.baseTargetSkillVersion.id,
    requested_source_skill_version_id: skillMergeRequest.requestedSourceSkillVersion.id,
    requested_target_skill_version_id: skillMergeRequest.requestedTargetSkillVersion.id,
    pre_merge_target_skill_version_id: skillMergeRequest.preMergeTargetSkillVersion?.id ?? null,
    merged_target_skill_version_id: skillMergeRequest.mergedTargetSkillVersion?.id ?? null,
    rollback_target_skill_version_id: skillMergeRequest.rollbackTargetSkillVersion?.id ?? null,
    created_by: skillMergeRequest.createdByResourceActor
      ? await presentDocumentParticipantActor(skillMergeRequest.createdByResourceActor, opts)
      : null,
    item_count: skillMergeRequest._count.items,
    comment_count: skillMergeRequest._count.comments,
    merge_started_at: skillMergeRequest.mergeStartedAt ?? null,
    merged_at: skillMergeRequest.mergedAt ?? null,
    closed_at: skillMergeRequest.closedAt ?? null,
    rolled_back_at: skillMergeRequest.rolledBackAt ?? null,
    created_at: skillMergeRequest.createdAt,
    updated_at: skillMergeRequest.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.merge_request'),
      id: v.string(),
      status: statusSchema,
      direction: directionSchema,
      base_strategy: baseStrategySchema,
      title: v.string(),
      description: v.nullable(v.string()),
      merge_error: v.nullable(v.string()),
      merge_error_code: errorCodeSchema,
      source_skill_id: v.string(),
      target_skill_id: v.string(),
      base_target_skill_version_id: v.string(),
      requested_source_skill_version_id: v.string(),
      requested_target_skill_version_id: v.string(),
      pre_merge_target_skill_version_id: v.nullable(v.string()),
      merged_target_skill_version_id: v.nullable(v.string()),
      rollback_target_skill_version_id: v.nullable(v.string()),
      created_by: v.nullable(documentParticipantActorSchema),
      item_count: v.number(),
      comment_count: v.number(),
      merge_started_at: v.nullable(v.date()),
      merged_at: v.nullable(v.date()),
      closed_at: v.nullable(v.date()),
      rolled_back_at: v.nullable(v.date()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let v1SkillMergeRequestItemPresenter = Presenter.create(skillMergeRequestItemType)
  .presenter(async ({ skillMergeRequestItem }, opts) => ({
    object: 'skill.merge_request.item' as const,
    id: skillMergeRequestItem.id,
    skill_merge_request_id: skillMergeRequestItem.skillMergeRequest.id,
    path: skillMergeRequestItem.path,
    kind: skillMergeRequestItem.kind,
    change_type: skillMergeRequestItem.changeType,
    status: skillMergeRequestItem.status,
    resolution_type: skillMergeRequestItem.resolutionType ?? null,
    conflict_reason: skillMergeRequestItem.conflictReason ?? null,
    resolution: skillMergeRequestItem.resolution ?? null,
    resolved_by: skillMergeRequestItem.resolvedByResourceActor
      ? await presentDocumentParticipantActor(skillMergeRequestItem.resolvedByResourceActor, opts)
      : null,
    resolved_at: skillMergeRequestItem.resolvedAt ?? null,
    applied_at: skillMergeRequestItem.appliedAt ?? null,
    created_at: skillMergeRequestItem.createdAt,
    updated_at: skillMergeRequestItem.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.merge_request.item'),
      id: v.string(),
      skill_merge_request_id: v.string(),
      path: v.string(),
      kind: itemKindSchema,
      change_type: itemChangeTypeSchema,
      status: itemStatusSchema,
      resolution_type: resolutionTypeSchema,
      conflict_reason: v.nullable(v.string()),
      resolution: v.nullable(v.record(v.any())),
      resolved_by: v.nullable(documentParticipantActorSchema),
      resolved_at: v.nullable(v.date()),
      applied_at: v.nullable(v.date()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let v1SkillMergeRequestCommentPresenter = Presenter.create(skillMergeRequestCommentType)
  .presenter(async ({ skillMergeRequestComment }, opts) => ({
    object: 'skill.merge_request.comment' as const,
    id: skillMergeRequestComment.id,
    skill_merge_request_item_id: skillMergeRequestComment.skillMergeRequestItem?.id ?? null,
    actor: await presentDocumentParticipantActor(skillMergeRequestComment.resourceActor, opts),
    body: skillMergeRequestComment.body,
    path: skillMergeRequestComment.path ?? null,
    in_reply_to_comment_id: skillMergeRequestComment.inReplyToComment?.id ?? null,
    deleted_at: skillMergeRequestComment.deletedAt ?? null,
    created_at: skillMergeRequestComment.createdAt,
    updated_at: skillMergeRequestComment.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.merge_request.comment'),
      id: v.string(),
      skill_merge_request_item_id: v.nullable(v.string()),
      actor: documentParticipantActorSchema,
      body: v.string(),
      path: v.nullable(v.string()),
      in_reply_to_comment_id: v.nullable(v.string()),
      deleted_at: v.nullable(v.date()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let v1SkillMergeRequestEventPresenter = Presenter.create(skillMergeRequestEventType)
  .presenter(async ({ skillMergeRequestEvent }, opts) => ({
    object: 'skill.merge_request.event' as const,
    id: skillMergeRequestEvent.id,
    type: skillMergeRequestEvent.type,
    actor: skillMergeRequestEvent.resourceActor
      ? await presentDocumentParticipantActor(skillMergeRequestEvent.resourceActor, opts)
      : null,
    comment: skillMergeRequestEvent.comment
      ? await v1SkillMergeRequestCommentPresenter
          .present({ skillMergeRequestComment: skillMergeRequestEvent.comment }, opts)
          .run()
      : null,
    error_code: skillMergeRequestEvent.errorCode ?? null,
    error_message: skillMergeRequestEvent.errorMessage ?? null,
    created_at: skillMergeRequestEvent.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.merge_request.event'),
      id: v.string(),
      type: eventTypeSchema,
      actor: v.nullable(documentParticipantActorSchema),
      comment: v.nullable(v1SkillMergeRequestCommentPresenter.schema),
      error_code: errorCodeSchema,
      error_message: v.nullable(v.string()),
      created_at: v.date()
    })
  )
  .build();

export let v1SkillMergePlanPresenter = Presenter.create(skillMergePlanType)
  .presenter(async ({ skillMergePlan }, opts) => ({
    object: 'skill.merge_plan' as const,
    merge_request: await v1SkillMergeRequestPresenter
      .present({ skillMergeRequest: skillMergePlan.mergeRequest }, opts)
      .run(),
    items: await Promise.all(
      skillMergePlan.items.map(async planItem => ({
        item: await v1SkillMergeRequestItemPresenter
          .present({ skillMergeRequestItem: planItem.item }, opts)
          .run(),
        base: planItem.base ? presentSnapshotItem(planItem.base) : null,
        source: planItem.source ? presentSnapshotItem(planItem.source) : null,
        target: planItem.target ? presentSnapshotItem(planItem.target) : null,
        document_merge: planItem.documentMerge
          ? {
              base_content: planItem.documentMerge.baseContent ?? null,
              source_content: planItem.documentMerge.sourceContent ?? null,
              target_content: planItem.documentMerge.targetContent ?? null,
              has_conflict: planItem.documentMerge.hasConflict
            }
          : null
      }))
    )
  }))
  .schema(
    v.object({
      object: v.literal('skill.merge_plan'),
      merge_request: v1SkillMergeRequestPresenter.schema,
      items: v.array(
        v.object({
          item: v1SkillMergeRequestItemPresenter.schema,
          base: v.nullable(snapshotItemSchema),
          source: v.nullable(snapshotItemSchema),
          target: v.nullable(snapshotItemSchema),
          document_merge: v.nullable(documentMergeSchema)
        })
      )
    })
  )
  .build();
