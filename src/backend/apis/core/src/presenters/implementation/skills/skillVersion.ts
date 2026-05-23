import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { skillVersionSnapshotType, skillVersionType } from '../../types';

let skillVersionSnapshotItemSchema = v.object({
  object: v.literal('skill.version.snapshot.item'),
  id: v.string(),
  kind: v.enumOf(['file', 'document', 'directory']),
  path: v.string(),
  file_id: v.nullable(v.string()),
  document_id: v.nullable(v.string()),
  document_version_id: v.nullable(v.string()),
  content: v.nullable(v.string()),
  created_at: v.date()
});

export let v1SkillVersionPresenter = Presenter.create(skillVersionType)
  .presenter(async ({ skillVersion }) => ({
    object: 'skill.version' as const,
    id: skillVersion.id,
    skill_id: skillVersion.skillId,
    store_id: skillVersion.storeId,
    store_version_id: skillVersion.storeVersionId,
    version_number: skillVersion.versionNumber,
    created_at: skillVersion.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.version'),
      id: v.string(),
      skill_id: v.string(),
      store_id: v.string(),
      store_version_id: v.string(),
      version_number: v.number(),
      created_at: v.date()
    })
  )
  .build();

export let v1SkillVersionSnapshotPresenter = Presenter.create(skillVersionSnapshotType)
  .presenter(async ({ skillVersionSnapshot }) => ({
    object: 'skill.version.snapshot' as const,
    id: skillVersionSnapshot.id,
    skill_id: skillVersionSnapshot.skillId,
    store_id: skillVersionSnapshot.storeId,
    store_version_id: skillVersionSnapshot.storeVersionId,
    version_number: skillVersionSnapshot.versionNumber,
    items: skillVersionSnapshot.items.map(item => ({
      object: 'skill.version.snapshot.item' as const,
      id: item.id,
      kind: item.kind,
      path: item.path,
      file_id: item.fileId ?? null,
      document_id: item.documentId ?? null,
      document_version_id: item.documentVersionId ?? null,
      content: item.content ?? null,
      created_at: item.createdAt
    })),
    created_at: skillVersionSnapshot.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.version.snapshot'),
      id: v.string(),
      skill_id: v.string(),
      store_id: v.string(),
      store_version_id: v.string(),
      version_number: v.number(),
      items: v.array(skillVersionSnapshotItemSchema),
      created_at: v.date()
    })
  )
  .build();
