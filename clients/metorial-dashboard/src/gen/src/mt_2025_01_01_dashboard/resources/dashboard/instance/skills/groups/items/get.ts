import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsGroupsItemsGetOutput = {
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
};

export let mapDashboardInstanceSkillsGroupsItemsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsGroupsItemsGetOutput>(
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
    ],
    1
  );
