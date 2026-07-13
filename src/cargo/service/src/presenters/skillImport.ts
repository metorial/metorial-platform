import type { SkillImportRecord } from '@metorial-cargo/module-skill';
import { actorPresenter } from './actor';
import { skillPresenter } from './skill';

export let skillImportPresenter = (skillImport: SkillImportRecord) => {
  let completedCount = skillImport.items.filter(item => item.status === 'completed').length;
  let failedCount = skillImport.items.filter(item => item.status === 'failed').length;

  return {
    object: 'cargo#skillImport',
    id: skillImport.id,
    status: skillImport.status,
    source:
      skillImport.sourceType === 'public_repository'
        ? {
            type: 'public' as const,
            repositoryUrl: skillImport.repositoryUrl!,
            repositoryName: skillImport.repositoryName,
            ref: skillImport.ref
          }
        : {
            type: 'origin' as const,
            repositoryId: skillImport.repositoryId!,
            repositoryName: skillImport.repositoryName,
            ref: skillImport.ref,
            path: skillImport.path
          },
    codeBucketId: skillImport.codeBucketId,
    error: skillImport.error,
    results: {
      total: skillImport.items.length,
      completed: completedCount,
      failed: failedCount,
      pending: skillImport.items.length - completedCount - failedCount
    },
    items: skillImport.items.map(item => ({
      object: 'cargo#skillImportItem',
      id: item.id,
      status: item.status,
      path: item.path,
      error: item.error,
      skill: item.skill ? skillPresenter(item.skill) : null,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      createdAt: item.createdAt
    })),
    createdBy: skillImport.creatorTenantActor
      ? actorPresenter(skillImport.creatorTenantActor)
      : null,
    startedAt: skillImport.startedAt,
    completedAt: skillImport.completedAt,
    createdAt: skillImport.createdAt
  };
};
