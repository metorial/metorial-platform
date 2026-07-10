import { mtMap } from '@metorial/util-resource-mapper';

export type SkillsForkSyncsCreateOutput = {
  object: 'skill.fork_sync';
  id: string;
  status:
    | 'pending'
    | 'processing'
    | 'action_required'
    | 'completed'
    | 'failed'
    | 'cancelled';
  forkSkillId: string;
  upstreamSkillId: string;
  mergeRequestId: string | null;
  error: string | null;
  processingStartedAt: Date | null;
  actionRequiredAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapSkillsForkSyncsCreateOutput =
  mtMap.object<SkillsForkSyncsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    forkSkillId: mtMap.objectField('fork_skill_id', mtMap.passthrough()),
    upstreamSkillId: mtMap.objectField(
      'upstream_skill_id',
      mtMap.passthrough()
    ),
    mergeRequestId: mtMap.objectField('merge_request_id', mtMap.passthrough()),
    error: mtMap.objectField('error', mtMap.passthrough()),
    processingStartedAt: mtMap.objectField(
      'processing_started_at',
      mtMap.date()
    ),
    actionRequiredAt: mtMap.objectField('action_required_at', mtMap.date()),
    completedAt: mtMap.objectField('completed_at', mtMap.date()),
    failedAt: mtMap.objectField('failed_at', mtMap.date()),
    cancelledAt: mtMap.objectField('cancelled_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type SkillsForkSyncsCreateBody = { skillId: string };

export let mapSkillsForkSyncsCreateBody =
  mtMap.object<SkillsForkSyncsCreateBody>({
    skillId: mtMap.objectField('skill_id', mtMap.passthrough())
  });

