import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsFilesListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSkillsFilesListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsFilesListOutput>(
    [
      7,
      [1, ['skill_id', 'store_item_id', 'document_id', 'file_id', 'updated_at']]
    ],
    1
  );
