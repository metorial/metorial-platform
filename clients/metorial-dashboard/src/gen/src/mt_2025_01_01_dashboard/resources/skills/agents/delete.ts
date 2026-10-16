import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SkillsAgentsDeleteOutput = {
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

export let mapSkillsAgentsDeleteOutput =
  /* @__PURE__ */ mapObject<SkillsAgentsDeleteOutput>(
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
