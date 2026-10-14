import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsAgentsCreateOutput = {
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

export let mapDashboardInstanceSkillsAgentsCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsAgentsCreateOutput>(
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

export type DashboardInstanceSkillsAgentsCreateBody = {
  name: string;
  description?: string | null | undefined;
  content?: string | undefined;
};

export let mapDashboardInstanceSkillsAgentsCreateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsAgentsCreateBody>(0);
