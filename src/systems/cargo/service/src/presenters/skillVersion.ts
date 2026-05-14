import type {
  SkillVersionRecord,
  SkillVersionSnapshot
} from '../services/skillVersion';

export let skillVersionPresenter = (version: SkillVersionRecord) => ({
  object: 'cargo#skillVersion',
  id: version.id,
  skillId: version.skill.id,
  storeId: version.skill.store.id,
  storeVersionId: version.storeVersion.id,
  versionNumber: version.versionNumber,
  createdAt: version.createdAt
});

export let skillVersionSnapshotPresenter = (snapshot: SkillVersionSnapshot) => ({
  object: 'cargo#skillVersionSnapshot',
  id: snapshot.id,
  skillId: snapshot.skillId,
  storeId: snapshot.storeId,
  storeVersionId: snapshot.storeVersionId,
  versionNumber: snapshot.versionNumber,
  items: snapshot.items.map(item => ({
    id: item.id,
    kind: item.kind,
    path: item.path,
    fileId: item.fileId,
    documentId: item.documentId,
    documentVersionId: item.documentVersionId,
    content: item.content,
    createdAt: item.createdAt
  })),
  createdAt: snapshot.createdAt
});
