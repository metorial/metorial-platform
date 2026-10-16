import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsAgentsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSkillsAgentsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsAgentsListOutput>(
    [
      7,
      [
        1,
        [
          'skill_id',
          'store_id',
          'store_item_id',
          'document_id',
          'archived_at',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSkillsAgentsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { includeArchived?: boolean | undefined };

export let mapDashboardInstanceSkillsAgentsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsAgentsListQuery>([
    3,
    [[0, [1, ['include_archived']]]]
  ]);
