import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSkillsMergeRequestsItemsResolveOutput = {
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

export let mapManagementInstanceSkillsMergeRequestsItemsResolveOutput =
  mtMap.object<ManagementInstanceSkillsMergeRequestsItemsResolveOutput>({
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
    resolutionType: mtMap.objectField('resolution_type', mtMap.passthrough()),
    conflictReason: mtMap.objectField('conflict_reason', mtMap.passthrough()),
    resolution: mtMap.objectField('resolution', mtMap.passthrough()),
    resolvedByActorId: mtMap.objectField(
      'resolved_by_actor_id',
      mtMap.passthrough()
    ),
    resolvedAt: mtMap.objectField('resolved_at', mtMap.date()),
    appliedAt: mtMap.objectField('applied_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceSkillsMergeRequestsItemsResolveBody = {
  resolutionType:
    | 'accept_source'
    | 'keep_target'
    | 'remove'
    | 'edit_document'
    | 'replace_file'
    | 'skip';
  resolution?:
    | {
        title?: string | undefined;
        content?: string | undefined;
        fileId?: string | undefined;
      }
    | null
    | undefined;
};

export let mapManagementInstanceSkillsMergeRequestsItemsResolveBody =
  mtMap.object<ManagementInstanceSkillsMergeRequestsItemsResolveBody>({
    resolutionType: mtMap.objectField('resolution_type', mtMap.passthrough()),
    resolution: mtMap.objectField(
      'resolution',
      mtMap.object({
        title: mtMap.objectField('title', mtMap.passthrough()),
        content: mtMap.objectField('content', mtMap.passthrough()),
        fileId: mtMap.objectField('fileId', mtMap.passthrough())
      })
    )
  });

