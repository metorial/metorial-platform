import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsGroupsListOutput = {
  items: {
    object: 'skill.group';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    allowConsumerSkillAssignment: boolean;
    skills: {
      object: 'skill';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      slug: string;
      name: string;
      description: string | null;
      imageUrl: string;
      clientName: string;
      clientDescription: string | null;
      clientMetadata: Record<string, any> | null;
      license: string | null;
      compatibility: string | null;
      metadata: Record<string, any> | null;
      createdAt: Date;
      updatedAt: Date;
    }[];
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSkillsGroupsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsGroupsListOutput>(
    [
      7,
      [
        1,
        [
          'allow_consumer_skill_assignment',
          [
            'skills',
            0,
            [
              2,
              [
                1,
                [
                  'image_url',
                  'client_name',
                  'client_description',
                  'client_metadata',
                  'created_at',
                  'updated_at'
                ]
              ]
            ]
          ],
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSkillsGroupsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  id?: string | string[] | undefined;
  skillId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceSkillsGroupsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsGroupsListQuery>([
    3,
    [[0, [1, ['skill_id', ['created_at', 1, 5], ['updated_at', 1, 5]]]]]
  ]);
