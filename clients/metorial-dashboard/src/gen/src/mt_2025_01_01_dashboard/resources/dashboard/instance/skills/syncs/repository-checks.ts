import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsSyncsRepositoryChecksOutput = {
  object: 'skill.sync_repository_checks';
  items: {
    object: 'skill.sync_repository_check';
    propagationId: string;
    repoId: string;
    provider: 'github' | 'gitlab' | 'bitbucket' | null;
    repositoryName: string;
    repositoryUrl: string | null;
    pullRequestUrl: string | null;
    repositoryAccessMode: 'pull_request' | 'default_branch';
    forceMergeOrPush: boolean;
    mergeBeforeChecksPass: boolean;
    overrideAttemptStatus:
      | 'not_attempted'
      | 'attempting'
      | 'refused'
      | 'waiting'
      | 'succeeded';
    overrideRefusalReason: string | null;
    targetBranch: string | null;
    status:
      | 'pending'
      | 'processing'
      | 'waiting_for_review'
      | 'completed'
      | 'failed'
      | 'canceled';
    originStatus: string | null;
    blockers: string[];
    checks: {
      name: string;
      status: string;
      url: string | null;
      summary: string | null;
    }[];
    reviewStatus: string | null;
    requiredReviewCount: number | null;
    approvedReviewCount: number | null;
    mergeability: string | null;
    lastCheckedAt: Date | null;
    errorMessage: string | null;
  }[];
};

export let mapDashboardInstanceSkillsSyncsRepositoryChecksOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsSyncsRepositoryChecksOutput>(
    [
      [
        'items',
        0,
        [
          2,
          [
            1,
            [
              'propagation_id',
              'repo_id',
              'repository_name',
              'repository_url',
              'pull_request_url',
              'repository_access_mode',
              'force_merge_or_push',
              'merge_before_checks_pass',
              'override_attempt_status',
              'override_refusal_reason',
              'target_branch',
              'origin_status',
              'review_status',
              'required_review_count',
              'approved_review_count',
              'last_checked_at',
              'error_message'
            ]
          ]
        ]
      ]
    ],
    1
  );
