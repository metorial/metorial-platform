import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillSyncType } from '../../types';

let skillSyncRepositoryPropagationSchema = v.object({
  object: v.literal('skill.sync_repository_propagation'),
  id: v.string(),
  status: v.enumOf([
    'pending',
    'processing',
    'waiting_for_review',
    'completed',
    'failed',
    'canceled'
  ]),
  repo_id: v.string(),
  repository_access_mode: v.enumOf(['pull_request', 'default_branch']),
  branch_name: v.string(),
  pr_name: v.string(),
  pr_description: v.nullable(v.string()),
  commit_message: v.nullable(v.string()),
  error_message: v.nullable(v.string()),
  created_at: v.date(),
  updated_at: v.date(),
  started_at: v.nullable(v.date()),
  completed_at: v.nullable(v.date())
});

export let v1SkillSyncPresenter = Presenter.create(skillSyncType)
  .presenter(async ({ skillSync }) => ({
    object: 'skill.sync' as const,
    id: skillSync.id,
    status: skillSync.status,
    skill_marketplace_id: skillSync.destination.skillMarketplace?.id ?? null,
    skill_plugin_id: skillSync.destination.skillPlugin?.id ?? null,
    logs: [...(skillSync.logs as [number, string][])]
      .sort(([left], [right]) => left - right)
      .map(([ts, msg]) => ({
        timestamp: new Date(ts),
        message: msg
      })),
    repository_propagations: skillSync.repositoryPropagations.map(propagation => ({
      object: 'skill.sync_repository_propagation' as const,
      id: propagation.id,
      status: propagation.status,
      repo_id: propagation.skillRepository.repoId,
      repository_access_mode: propagation.repositoryAccessMode,
      branch_name: propagation.branchName,
      pr_name: propagation.prName,
      pr_description: propagation.prDescription,
      commit_message: propagation.commitMessage,
      error_message: propagation.errorMessage,
      created_at: propagation.createdAt,
      updated_at: propagation.updatedAt,
      started_at: propagation.startedAt,
      completed_at: propagation.completedAt
    })),
    created_at: skillSync.createdAt,
    started_at: skillSync.startedAt,
    completed_at: skillSync.completedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.sync'),
      id: v.string(),
      status: v.enumOf([
        'pending',
        'completed',
        'failed',
        'processing',
        'waiting_for_review',
        'canceled'
      ]),
      skill_marketplace_id: v.nullable(v.string()),
      skill_plugin_id: v.nullable(v.string()),
      logs: v.array(v.object({ timestamp: v.date(), message: v.string() })),
      repository_propagations: v.array(skillSyncRepositoryPropagationSchema),
      created_at: v.date(),
      started_at: v.nullable(v.date()),
      completed_at: v.nullable(v.date())
    })
  )
  .build();
