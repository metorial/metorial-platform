import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsVersionsSnapshotGetOutput = {
  object: 'skill.version.snapshot';
  id: string;
  skillId: string;
  storeId: string;
  storeVersionId: string;
  versionNumber: number;
  items: {
    object: 'skill.version.snapshot.item';
    id: string;
    kind: 'file' | 'document' | 'directory';
    path: string;
    fileId: string | null;
    documentId: string | null;
    documentVersionId: string | null;
    content: string | null;
    createdAt: Date;
  }[];
  createdAt: Date;
};

export let mapDashboardInstanceSkillsVersionsSnapshotGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsVersionsSnapshotGetOutput>(
    [
      'skill_id',
      'store_id',
      'store_version_id',
      'version_number',
      [
        'items',
        0,
        [
          2,
          [1, ['file_id', 'document_id', 'document_version_id', 'created_at']]
        ]
      ],
      'created_at'
    ],
    1
  );
