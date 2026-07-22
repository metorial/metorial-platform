import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillSyncRepositoryChecksType } from '../../types';

let repositoryCheckSchema = v.object({
  object: v.literal('skill.sync_repository_check'),
  propagation_id: v.string(),
  repo_id: v.string(),
  provider: v.nullable(v.enumOf(['github', 'gitlab', 'bitbucket'])),
  repository_name: v.string(),
  repository_url: v.nullable(v.string()),
  pull_request_url: v.nullable(v.string()),
  repository_access_mode: v.enumOf(['pull_request', 'default_branch']),
  target_branch: v.nullable(v.string()),
  status: v.enumOf([
    'pending',
    'processing',
    'waiting_for_review',
    'completed',
    'failed',
    'canceled'
  ]),
  origin_status: v.nullable(v.string()),
  blockers: v.array(v.string()),
  checks: v.array(
    v.object({
      name: v.string(),
      status: v.string(),
      url: v.nullable(v.string()),
      summary: v.nullable(v.string())
    })
  ),
  review_status: v.nullable(v.string()),
  required_review_count: v.nullable(v.number()),
  approved_review_count: v.nullable(v.number()),
  mergeability: v.nullable(v.string()),
  last_checked_at: v.nullable(v.date()),
  error_message: v.nullable(v.string())
});

export let v1SkillSyncRepositoryChecksPresenter = Presenter.create(
  skillSyncRepositoryChecksType
)
  .presenter(async ({ repositoryChecks }) => ({
    object: 'skill.sync_repository_checks' as const,
    items: repositoryChecks.map(repositoryCheck => ({
      object: 'skill.sync_repository_check' as const,
      propagation_id: repositoryCheck.propagationId,
      repo_id: repositoryCheck.repoId,
      provider: repositoryCheck.provider,
      repository_name: repositoryCheck.repositoryName,
      repository_url: repositoryCheck.repositoryUrl,
      pull_request_url: repositoryCheck.pullRequestUrl,
      repository_access_mode: repositoryCheck.repositoryAccessMode,
      target_branch: repositoryCheck.targetBranch,
      status: repositoryCheck.status,
      origin_status: repositoryCheck.originStatus,
      blockers: repositoryCheck.blockers,
      checks: repositoryCheck.checks.map(check => ({
        name: check.name,
        status: check.status,
        url: check.url,
        summary: check.summary
      })),
      review_status: repositoryCheck.reviewStatus,
      required_review_count: repositoryCheck.requiredReviewCount,
      approved_review_count: repositoryCheck.approvedReviewCount,
      mergeability: repositoryCheck.mergeability,
      last_checked_at: repositoryCheck.lastCheckedAt,
      error_message: repositoryCheck.errorMessage
    }))
  }))
  .schema(
    v.object({
      object: v.literal('skill.sync_repository_checks'),
      items: v.array(repositoryCheckSchema)
    })
  )
  .build();
