import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsFilesPutOutput = {
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

export let mapManagementInstanceSkillsFilesPutOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsFilesPutOutput>(
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

export type ManagementInstanceSkillsFilesPutBody = {
  path: string;
  content?: string | undefined;
  fileId?: string | undefined;
  ifMatch?: string | null | undefined;
};

export let mapManagementInstanceSkillsFilesPutBody =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsFilesPutBody>([
    'file_id',
    'if_match'
  ]);
