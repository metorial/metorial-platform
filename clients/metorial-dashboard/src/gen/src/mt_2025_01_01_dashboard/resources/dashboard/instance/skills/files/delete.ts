import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsFilesDeleteOutput = {
  object: 'skill.file_change';
  type: 'put' | 'delete' | 'move';
  path: string;
  previousPath: string | null;
  file: {
    object: 'skill.file';
    path: string;
    kind: 'document' | 'file';
    size: number;
    etag: string;
    skillId: string;
    storeItemId: string;
    documentId: string | null;
    fileId: string | null;
    updatedAt: Date;
  } | null;
};

export let mapDashboardInstanceSkillsFilesDeleteOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsFilesDeleteOutput>(
    [
      'previous_path',
      [
        'file',
        0,
        [
          1,
          ['skill_id', 'store_item_id', 'document_id', 'file_id', 'updated_at']
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSkillsFilesDeleteQuery = {
  path: string;
  ifMatch?: string | undefined;
};

export let mapDashboardInstanceSkillsFilesDeleteQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsFilesDeleteQuery>([
    'if_match'
  ]);
