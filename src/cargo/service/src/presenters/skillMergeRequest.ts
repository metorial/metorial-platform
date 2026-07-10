import type {
  SkillMergePlan,
  SkillMergeRequestCommentRecord,
  SkillMergeRequestItemRecord,
  SkillMergeRequestRecord
} from '@metorial-cargo/module-skill';

let mergeRequestSkillPresenter = (skill: SkillMergeRequestRecord['sourceSkill']) => ({
  object: 'cargo#skill',
  id: skill.id,
  name: skill.name,
  storeId: skill.store.id
});

let mergeRequestVersionPresenter = (
  version:
    | SkillMergeRequestRecord['baseTargetSkillVersion']
    | SkillMergeRequestRecord['preMergeTargetSkillVersion']
) =>
  version
    ? {
        object: 'cargo#skillVersion',
        id: version.id,
        versionNumber: version.versionNumber,
        storeVersionId: version.storeVersionOid.toString(),
        createdAt: version.createdAt
      }
    : undefined;

export let skillMergeRequestPresenter = (mergeRequest: SkillMergeRequestRecord) => ({
  object: 'cargo#skillMergeRequest',
  id: mergeRequest.id,
  status: mergeRequest.status,
  direction: mergeRequest.direction,
  baseStrategy: mergeRequest.baseStrategy,
  title: mergeRequest.title,
  description: mergeRequest.description,
  mergeError: mergeRequest.mergeError,
  mergeErrorCode: mergeRequest.mergeErrorCode,
  sourceSkillId: mergeRequest.sourceSkill.id,
  targetSkillId: mergeRequest.targetSkill.id,
  sourceSkill: mergeRequestSkillPresenter(mergeRequest.sourceSkill),
  targetSkill: mergeRequestSkillPresenter(mergeRequest.targetSkill),
  baseTargetSkillVersionId: mergeRequest.baseTargetSkillVersion.id,
  requestedSourceSkillVersionId: mergeRequest.requestedSourceSkillVersion.id,
  requestedTargetSkillVersionId: mergeRequest.requestedTargetSkillVersion.id,
  preMergeTargetSkillVersionId: mergeRequest.preMergeTargetSkillVersion?.id,
  mergedTargetSkillVersionId: mergeRequest.mergedTargetSkillVersion?.id,
  rollbackTargetSkillVersionId: mergeRequest.rollbackTargetSkillVersion?.id,
  baseTargetSkillVersion: mergeRequestVersionPresenter(mergeRequest.baseTargetSkillVersion),
  requestedSourceSkillVersion: mergeRequestVersionPresenter(
    mergeRequest.requestedSourceSkillVersion
  ),
  requestedTargetSkillVersion: mergeRequestVersionPresenter(
    mergeRequest.requestedTargetSkillVersion
  ),
  preMergeTargetSkillVersion: mergeRequestVersionPresenter(
    mergeRequest.preMergeTargetSkillVersion
  ),
  mergedTargetSkillVersion: mergeRequestVersionPresenter(
    mergeRequest.mergedTargetSkillVersion
  ),
  rollbackTargetSkillVersion: mergeRequestVersionPresenter(
    mergeRequest.rollbackTargetSkillVersion
  ),
  createdByActorId: mergeRequest.createdByTenantActor?.id,
  mergeStartedByActorId: mergeRequest.mergeStartedByTenantActor?.id,
  mergedByActorId: mergeRequest.mergedByTenantActor?.id,
  closedByActorId: mergeRequest.closedByTenantActor?.id,
  rolledBackByActorId: mergeRequest.rolledBackByTenantActor?.id,
  itemCount: mergeRequest._count.items,
  commentCount: mergeRequest._count.comments,
  mergeStartedAt: mergeRequest.mergeStartedAt,
  mergedAt: mergeRequest.mergedAt,
  closedAt: mergeRequest.closedAt,
  rolledBackAt: mergeRequest.rolledBackAt,
  createdAt: mergeRequest.createdAt,
  updatedAt: mergeRequest.updatedAt
});

export let skillMergeRequestItemPresenter = (item: SkillMergeRequestItemRecord) => ({
  object: 'cargo#skillMergeRequestItem',
  id: item.id,
  skillMergeRequestId: item.skillMergeRequest.id,
  path: item.path,
  kind: item.kind,
  changeType: item.changeType,
  status: item.status,
  resolutionType: item.resolutionType,
  conflictReason: item.conflictReason,
  resolution: item.resolution,
  baseFileId: item.baseFile?.id,
  sourceFileId: item.sourceFile?.id,
  targetFileId: item.targetFile?.id,
  baseDocumentId: item.baseDocument?.id,
  sourceDocumentId: item.sourceDocument?.id,
  targetDocumentId: item.targetDocument?.id,
  baseDocumentVersionId: item.baseDocumentVersion?.id,
  sourceDocumentVersionId: item.sourceDocumentVersion?.id,
  targetDocumentVersionId: item.targetDocumentVersion?.id,
  resolvedByActorId: item.resolvedByTenantActor?.id,
  resolvedAt: item.resolvedAt,
  appliedAt: item.appliedAt,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

export let skillMergeRequestCommentPresenter = (comment: SkillMergeRequestCommentRecord) => ({
  object: 'cargo#skillMergeRequestComment',
  id: comment.id,
  skillMergeRequestItemId: comment.skillMergeRequestItem?.id,
  actorId: comment.tenantActor.id,
  body: comment.body,
  path: comment.path,
  inReplyToCommentId: comment.inReplyToComment?.id,
  deletedAt: comment.deletedAt,
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt
});

export let skillMergePlanPresenter = (plan: SkillMergePlan) => ({
  object: 'cargo#skillMergePlan',
  mergeRequest: skillMergeRequestPresenter(plan.mergeRequest),
  items: plan.items.map(item => ({
    ...skillMergeRequestItemPresenter(item.item),
    base: item.base,
    source: item.source,
    target: item.target,
    documentMerge: item.documentMerge
  }))
});
