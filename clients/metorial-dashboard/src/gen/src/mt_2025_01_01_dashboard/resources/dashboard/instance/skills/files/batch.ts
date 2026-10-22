import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsFilesBatchOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSkillsFilesBatchOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsFilesBatchOutput>(
    [
      7,
      [
        1,
        [
          'previous_path',
          [
            'file',
            0,
            [
              1,
              [
                'skill_id',
                'store_item_id',
                'document_id',
                'file_id',
                'updated_at'
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSkillsFilesBatchBody = {
  changes: (
    | {
        type: 'put';
        path: string;
        content?: string | undefined;
        fileId?: string | undefined;
        ifMatch?: string | null | undefined;
      }
    | { type: 'delete'; path: string; ifMatch?: string | undefined }
    | {
        type: 'move';
        path: string;
        toPath: string;
        ifMatch?: string | undefined;
      }
  )[];
};

export let mapDashboardInstanceSkillsFilesBatchBody =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsFilesBatchBody>([
    ['changes', 0, [2, [3, [[0, [1, ['file_id', 'if_match', 'to_path']]]]]]]
  ]);
