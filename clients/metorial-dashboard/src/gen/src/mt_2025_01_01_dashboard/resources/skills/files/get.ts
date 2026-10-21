import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type SkillsFilesGetOutput = {
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

export let mapSkillsFilesGetOutput =
  /* @__PURE__ */ mapObject<SkillsFilesGetOutput>(
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

export type SkillsFilesGetQuery = { path: string };

export let mapSkillsFilesGetQuery =
  /* @__PURE__ */ createMapper<SkillsFilesGetQuery>(0);
