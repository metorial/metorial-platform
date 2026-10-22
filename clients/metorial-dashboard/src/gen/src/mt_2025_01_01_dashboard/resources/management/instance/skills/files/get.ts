import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsFilesGetOutput = {
  object: 'skill.file_content';
  path: string;
  kind: 'document' | 'file';
  size: number;
  etag: string;
  skillId: string;
  storeItemId: string;
  documentId: string | null;
  fileId: string | null;
  updatedAt: Date;
  content: string | null;
  downloadUrl: string | null;
};

export let mapManagementInstanceSkillsFilesGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsFilesGetOutput>(
    [
      'skill_id',
      'store_item_id',
      'document_id',
      'file_id',
      'updated_at',
      'download_url'
    ],
    1
  );

export type ManagementInstanceSkillsFilesGetQuery = { path: string };

export let mapManagementInstanceSkillsFilesGetQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsFilesGetQuery>(0);
