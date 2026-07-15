import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillForkSyncType } from '../../types';

let statusSchema = v.enumOf([
  'pending',
  'processing',
  'action_required',
  'completed',
  'failed',
  'cancelled'
]);

export let v1SkillForkSyncPresenter = Presenter.create(skillForkSyncType)
  .presenter(async ({ skillForkSync }) => ({
    object: 'skill.fork_sync' as const,
    id: skillForkSync.id,
    status: skillForkSync.status,
    fork_skill_id: skillForkSync.forkSkillId,
    upstream_skill_id: skillForkSync.upstreamSkillId,
    merge_request_id: skillForkSync.generatedMergeRequestId ?? null,
    error: skillForkSync.error ?? null,
    processing_started_at: skillForkSync.processingStartedAt ?? null,
    action_required_at: skillForkSync.actionRequiredAt ?? null,
    completed_at: skillForkSync.completedAt ?? null,
    failed_at: skillForkSync.failedAt ?? null,
    cancelled_at: skillForkSync.cancelledAt ?? null,
    created_at: skillForkSync.createdAt,
    updated_at: skillForkSync.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.fork_sync'),
      id: v.string(),
      status: statusSchema,
      fork_skill_id: v.string(),
      upstream_skill_id: v.string(),
      merge_request_id: v.nullable(v.string()),
      error: v.nullable(v.string()),
      processing_started_at: v.nullable(v.date()),
      action_required_at: v.nullable(v.date()),
      completed_at: v.nullable(v.date()),
      failed_at: v.nullable(v.date()),
      cancelled_at: v.nullable(v.date()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
