import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type SkillsAgentsUpdateOutput = {
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

export let mapSkillsAgentsUpdateOutput =
  /* @__PURE__ */ mapObject<SkillsAgentsUpdateOutput>(
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

export type SkillsAgentsUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
};

export let mapSkillsAgentsUpdateBody =
  /* @__PURE__ */ createMapper<SkillsAgentsUpdateBody>(0);
