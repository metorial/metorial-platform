import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsGroupsItemsListOutput = {
  items: {
    object: 'skill.group.item';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    skillGroupId: string;
    skill: {
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
    };
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSkillsGroupsItemsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsGroupsItemsListOutput>(
    [
      7,
      [
        1,
        [
          'skill_group_id',
          [
            'skill',
            0,
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
          ],
          'created_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceSkillsGroupsItemsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  id?: string | string[] | undefined;
  skillId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapManagementInstanceSkillsGroupsItemsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsGroupsItemsListQuery>([
    3,
    [[0, [1, ['skill_id', ['created_at', 1, 5]]]]]
  ]);
