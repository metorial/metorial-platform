import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<DashboardInstanceSkillsSyncsRepositoryChecksOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          propagationId: mtMap.objectField(
            'propagation_id',
            mtMap.passthrough()
          ),
          repoId: mtMap.objectField('repo_id', mtMap.passthrough()),
          provider: mtMap.objectField('provider', mtMap.passthrough()),
          repositoryName: mtMap.objectField(
            'repository_name',
            mtMap.passthrough()
          ),
          repositoryUrl: mtMap.objectField(
            'repository_url',
            mtMap.passthrough()
          ),
          pullRequestUrl: mtMap.objectField(
            'pull_request_url',
            mtMap.passthrough()
          ),
          repositoryAccessMode: mtMap.objectField(
            'repository_access_mode',
            mtMap.passthrough()
          ),
          targetBranch: mtMap.objectField('target_branch', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          originStatus: mtMap.objectField('origin_status', mtMap.passthrough()),
          blockers: mtMap.objectField(
            'blockers',
            mtMap.array(mtMap.passthrough())
          ),
          checks: mtMap.objectField(
            'checks',
            mtMap.array(
              mtMap.object({
                name: mtMap.objectField('name', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                url: mtMap.objectField('url', mtMap.passthrough()),
                summary: mtMap.objectField('summary', mtMap.passthrough())
              })
            )
          ),
          reviewStatus: mtMap.objectField('review_status', mtMap.passthrough()),
          requiredReviewCount: mtMap.objectField(
            'required_review_count',
            mtMap.passthrough()
          ),
          approvedReviewCount: mtMap.objectField(
            'approved_review_count',
            mtMap.passthrough()
          ),
          mergeability: mtMap.objectField('mergeability', mtMap.passthrough()),
          lastCheckedAt: mtMap.objectField('last_checked_at', mtMap.date()),
          errorMessage: mtMap.objectField('error_message', mtMap.passthrough())
        })
      )
    )
  });
