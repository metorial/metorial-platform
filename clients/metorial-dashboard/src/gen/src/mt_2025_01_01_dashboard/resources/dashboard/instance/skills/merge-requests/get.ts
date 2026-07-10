import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSkillsMergeRequestsGetOutput = {
  object: 'skill.merge_request';
  id: string;
  status: 'open' | 'closed' | 'merging' | 'merged';
  direction: 'fork_to_upstream' | 'upstream_to_fork';
  baseStrategy: 'exact' | 'inferred_created_at' | 'inferred_current';
  title: string;
  description: string | null;
  mergeError: string | null;
  mergeErrorCode:
    | 'target_changed'
    | 'unresolved_after_refresh'
    | 'apply_failed'
    | 'verification_failed'
    | 'enqueue_failed'
    | 'stale_merge_recovered'
    | null;
  sourceSkillId: string;
  targetSkillId: string;
  baseTargetSkillVersionId: string;
  requestedSourceSkillVersionId: string;
  requestedTargetSkillVersionId: string;
  preMergeTargetSkillVersionId: string | null;
  mergedTargetSkillVersionId: string | null;
  rollbackTargetSkillVersionId: string | null;
  createdByActorId: string | null;
  itemCount: number;
  commentCount: number;
  mergeStartedAt: Date | null;
  mergedAt: Date | null;
  closedAt: Date | null;
  rolledBackAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceSkillsMergeRequestsGetOutput =
  mtMap.object<DashboardInstanceSkillsMergeRequestsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    direction: mtMap.objectField('direction', mtMap.passthrough()),
    baseStrategy: mtMap.objectField('base_strategy', mtMap.passthrough()),
    title: mtMap.objectField('title', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    mergeError: mtMap.objectField('merge_error', mtMap.passthrough()),
    mergeErrorCode: mtMap.objectField('merge_error_code', mtMap.passthrough()),
    sourceSkillId: mtMap.objectField('source_skill_id', mtMap.passthrough()),
    targetSkillId: mtMap.objectField('target_skill_id', mtMap.passthrough()),
    baseTargetSkillVersionId: mtMap.objectField(
      'base_target_skill_version_id',
      mtMap.passthrough()
    ),
    requestedSourceSkillVersionId: mtMap.objectField(
      'requested_source_skill_version_id',
      mtMap.passthrough()
    ),
    requestedTargetSkillVersionId: mtMap.objectField(
      'requested_target_skill_version_id',
      mtMap.passthrough()
    ),
    preMergeTargetSkillVersionId: mtMap.objectField(
      'pre_merge_target_skill_version_id',
      mtMap.passthrough()
    ),
    mergedTargetSkillVersionId: mtMap.objectField(
      'merged_target_skill_version_id',
      mtMap.passthrough()
    ),
    rollbackTargetSkillVersionId: mtMap.objectField(
      'rollback_target_skill_version_id',
      mtMap.passthrough()
    ),
    createdByActorId: mtMap.objectField(
      'created_by_actor_id',
      mtMap.passthrough()
    ),
    itemCount: mtMap.objectField('item_count', mtMap.passthrough()),
    commentCount: mtMap.objectField('comment_count', mtMap.passthrough()),
    mergeStartedAt: mtMap.objectField('merge_started_at', mtMap.date()),
    mergedAt: mtMap.objectField('merged_at', mtMap.date()),
    closedAt: mtMap.objectField('closed_at', mtMap.date()),
    rolledBackAt: mtMap.objectField('rolled_back_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

