import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsForkSyncsGetOutput = {
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

export let mapDashboardInstanceSkillsForkSyncsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsForkSyncsGetOutput>(
    [
      'fork_skill_id',
      'upstream_skill_id',
      'merge_request_id',
      'processing_started_at',
      'action_required_at',
      'completed_at',
      'failed_at',
      'cancelled_at',
      'created_at',
      'updated_at'
    ],
    1
  );
