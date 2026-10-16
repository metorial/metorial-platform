import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsAgentsCreateOutput = {
  object: 'skill.agent';
  id: string;
  skillId: string;
  name: string;
  description: string | null;
  slug: string;
  status: 'active' | 'archived';
  storeId: string;
  storeItemId: string | null;
  path: string | null;
  documentId: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSkillsAgentsCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsAgentsCreateOutput>(
    [
      'skill_id',
      'store_id',
      'store_item_id',
      'document_id',
      'archived_at',
      'created_at',
      'updated_at'
    ],
    1
  );

export type ManagementInstanceSkillsAgentsCreateBody = {
  name: string;
  description?: string | null | undefined;
  content?: string | undefined;
};

export let mapManagementInstanceSkillsAgentsCreateBody =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsAgentsCreateBody>(0);
