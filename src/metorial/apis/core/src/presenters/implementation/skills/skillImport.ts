import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillImportType } from '../../types';

let skillImportItemSchema = v.object({
  object: v.literal('skill.import.item'),
  id: v.string(),
  status: v.enumOf(['pending', 'processing', 'completed', 'failed']),
  path: v.string(),
  error: v.nullable(v.string()),
  skill: v.nullable(
    v.object({
      id: v.string(),
      name: v.string(),
      description: v.nullable(v.string())
    })
  ),
  started_at: v.nullable(v.date()),
  completed_at: v.nullable(v.date()),
  created_at: v.date()
});

export let v1SkillImportPresenter = Presenter.create(skillImportType)
  .presenter(async ({ skillImport }) => ({
    object: 'skill.import' as const,
    id: skillImport.id,
    status: skillImport.status,
    source:
      skillImport.source.type === 'public'
        ? {
            type: 'public' as const,
            repository_url: skillImport.source.repositoryUrl,
            repository_name: skillImport.source.repositoryName,
            ref: skillImport.source.ref
          }
        : {
            type: 'origin' as const,
            repository_id: skillImport.source.repositoryId,
            repository_name: skillImport.source.repositoryName,
            ref: skillImport.source.ref,
            path: skillImport.source.path
          },
    code_bucket_id: skillImport.codeBucketId,
    error: skillImport.error,
    items: skillImport.items.map(item => ({
      object: 'skill.import.item' as const,
      id: item.id,
      status: item.status,
      path: item.path,
      error: item.error,
      skill: item.skill
        ? {
            id: item.skill.id,
            name: item.skill.name,
            description: item.skill.description
          }
        : null,
      started_at: item.startedAt,
      completed_at: item.completedAt,
      created_at: item.createdAt
    })),
    started_at: skillImport.startedAt,
    completed_at: skillImport.completedAt,
    created_at: skillImport.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.import'),
      id: v.string(),
      status: v.enumOf(['pending', 'processing', 'completed', 'failed']),
      source: v.union([
        v.object({
          type: v.literal('public'),
          repository_url: v.string(),
          repository_name: v.nullable(v.string()),
          ref: v.nullable(v.string())
        }),
        v.object({
          type: v.literal('origin'),
          repository_id: v.string(),
          repository_name: v.nullable(v.string()),
          ref: v.nullable(v.string()),
          path: v.nullable(v.string())
        })
      ]),
      code_bucket_id: v.nullable(v.string()),
      error: v.nullable(v.string()),
      items: v.array(skillImportItemSchema),
      started_at: v.nullable(v.date()),
      completed_at: v.nullable(v.date()),
      created_at: v.date()
    })
  )
  .build();
