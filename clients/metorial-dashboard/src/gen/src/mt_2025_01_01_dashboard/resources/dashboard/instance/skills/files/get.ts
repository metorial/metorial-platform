import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsFilesGetOutput = {
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

export let mapDashboardInstanceSkillsFilesGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsFilesGetOutput>(
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

export type DashboardInstanceSkillsFilesGetQuery = { path: string };

export let mapDashboardInstanceSkillsFilesGetQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsFilesGetQuery>(0);
