import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSkillsMergeRequestsPlanGetOutput = {
  object: 'skill.merge_plan';
  mergeRequest: {
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
  items: {
    item: {
      object: 'skill.merge_request.item';
      id: string;
      skillMergeRequestId: string;
      path: string;
      kind: 'file' | 'document' | 'directory';
      changeType: 'added' | 'modified' | 'removed' | 'unchanged' | 'conflicted';
      status: 'unresolved' | 'resolved' | 'skipped' | 'applied';
      resolutionType:
        | 'accept_source'
        | 'keep_target'
        | 'remove'
        | 'edit_document'
        | 'replace_file'
        | 'skip'
        | null;
      conflictReason: string | null;
      resolution: Record<string, any> | null;
      resolvedByActorId: string | null;
      resolvedAt: Date | null;
      appliedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    };
    base: {
      kind: 'file' | 'document' | 'directory';
      path: string;
      fileId: string | null;
      documentId: string | null;
      documentTitle: string | null;
      documentVersionId: string | null;
      content: string | null;
    } | null;
    source: {
      kind: 'file' | 'document' | 'directory';
      path: string;
      fileId: string | null;
      documentId: string | null;
      documentTitle: string | null;
      documentVersionId: string | null;
      content: string | null;
    } | null;
    target: {
      kind: 'file' | 'document' | 'directory';
      path: string;
      fileId: string | null;
      documentId: string | null;
      documentTitle: string | null;
      documentVersionId: string | null;
      content: string | null;
    } | null;
    documentMerge: {
      baseContent: string | null;
      sourceContent: string | null;
      targetContent: string | null;
      hasConflict: boolean;
    } | null;
  }[];
};

export let mapDashboardInstanceSkillsMergeRequestsPlanGetOutput =
  mtMap.object<DashboardInstanceSkillsMergeRequestsPlanGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    mergeRequest: mtMap.objectField(
      'merge_request',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        direction: mtMap.objectField('direction', mtMap.passthrough()),
        baseStrategy: mtMap.objectField('base_strategy', mtMap.passthrough()),
        title: mtMap.objectField('title', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        mergeError: mtMap.objectField('merge_error', mtMap.passthrough()),
        mergeErrorCode: mtMap.objectField(
          'merge_error_code',
          mtMap.passthrough()
        ),
        sourceSkillId: mtMap.objectField(
          'source_skill_id',
          mtMap.passthrough()
        ),
        targetSkillId: mtMap.objectField(
          'target_skill_id',
          mtMap.passthrough()
        ),
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
      })
    ),
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          item: mtMap.objectField(
            'item',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              skillMergeRequestId: mtMap.objectField(
                'skill_merge_request_id',
                mtMap.passthrough()
              ),
              path: mtMap.objectField('path', mtMap.passthrough()),
              kind: mtMap.objectField('kind', mtMap.passthrough()),
              changeType: mtMap.objectField('change_type', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              resolutionType: mtMap.objectField(
                'resolution_type',
                mtMap.passthrough()
              ),
              conflictReason: mtMap.objectField(
                'conflict_reason',
                mtMap.passthrough()
              ),
              resolution: mtMap.objectField('resolution', mtMap.passthrough()),
              resolvedByActorId: mtMap.objectField(
                'resolved_by_actor_id',
                mtMap.passthrough()
              ),
              resolvedAt: mtMap.objectField('resolved_at', mtMap.date()),
              appliedAt: mtMap.objectField('applied_at', mtMap.date()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          base: mtMap.objectField(
            'base',
            mtMap.object({
              kind: mtMap.objectField('kind', mtMap.passthrough()),
              path: mtMap.objectField('path', mtMap.passthrough()),
              fileId: mtMap.objectField('file_id', mtMap.passthrough()),
              documentId: mtMap.objectField('document_id', mtMap.passthrough()),
              documentTitle: mtMap.objectField(
                'document_title',
                mtMap.passthrough()
              ),
              documentVersionId: mtMap.objectField(
                'document_version_id',
                mtMap.passthrough()
              ),
              content: mtMap.objectField('content', mtMap.passthrough())
            })
          ),
          source: mtMap.objectField(
            'source',
            mtMap.object({
              kind: mtMap.objectField('kind', mtMap.passthrough()),
              path: mtMap.objectField('path', mtMap.passthrough()),
              fileId: mtMap.objectField('file_id', mtMap.passthrough()),
              documentId: mtMap.objectField('document_id', mtMap.passthrough()),
              documentTitle: mtMap.objectField(
                'document_title',
                mtMap.passthrough()
              ),
              documentVersionId: mtMap.objectField(
                'document_version_id',
                mtMap.passthrough()
              ),
              content: mtMap.objectField('content', mtMap.passthrough())
            })
          ),
          target: mtMap.objectField(
            'target',
            mtMap.object({
              kind: mtMap.objectField('kind', mtMap.passthrough()),
              path: mtMap.objectField('path', mtMap.passthrough()),
              fileId: mtMap.objectField('file_id', mtMap.passthrough()),
              documentId: mtMap.objectField('document_id', mtMap.passthrough()),
              documentTitle: mtMap.objectField(
                'document_title',
                mtMap.passthrough()
              ),
              documentVersionId: mtMap.objectField(
                'document_version_id',
                mtMap.passthrough()
              ),
              content: mtMap.objectField('content', mtMap.passthrough())
            })
          ),
          documentMerge: mtMap.objectField(
            'document_merge',
            mtMap.object({
              baseContent: mtMap.objectField(
                'base_content',
                mtMap.passthrough()
              ),
              sourceContent: mtMap.objectField(
                'source_content',
                mtMap.passthrough()
              ),
              targetContent: mtMap.objectField(
                'target_content',
                mtMap.passthrough()
              ),
              hasConflict: mtMap.objectField(
                'has_conflict',
                mtMap.passthrough()
              )
            })
          )
        })
      )
    )
  });

