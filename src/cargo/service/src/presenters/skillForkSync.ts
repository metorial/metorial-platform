import type { SkillForkSyncRecord } from '@metorial-cargo/module-skill';

export let skillForkSyncPresenter = (sync: SkillForkSyncRecord) => ({
  object: 'cargo#skillForkSync',
  id: sync.id,
  status: sync.status,
  forkSkillId: sync.forkSkill.id,
  upstreamSkillId: sync.upstreamSkill.id,
  generatedMergeRequestId: sync.generatedMergeRequest?.id,
  createdByActorId: sync.createdByTenantActor?.id,
  error: sync.error,
  processingStartedAt: sync.processingStartedAt,
  actionRequiredAt: sync.actionRequiredAt,
  completedAt: sync.completedAt,
  failedAt: sync.failedAt,
  cancelledAt: sync.cancelledAt,
  createdAt: sync.createdAt,
  updatedAt: sync.updatedAt
});
