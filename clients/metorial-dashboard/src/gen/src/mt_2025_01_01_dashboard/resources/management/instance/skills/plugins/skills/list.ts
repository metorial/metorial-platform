import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsPluginsSkillsListOutput = {
  items: {
    object: 'skill.plugin_skill';
    id: string;
    identifier: string;
    status: 'active' | 'archived' | 'deleted';
    clientName: string | null;
    clientDescription: string | null;
    clientMetadata: Record<string, any> | null;
    license: string | null;
    compatibility: string | null;
    skillConfigurationId: string | null;
    skillId: string;
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
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSkillsPluginsSkillsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsPluginsSkillsListOutput>(
    [
      7,
      [
        1,
        [
          'client_name',
          'client_description',
          'client_metadata',
          'skill_configuration_id',
          'skill_id',
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
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceSkillsPluginsSkillsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  skillId?: string | string[] | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  skillConfigurationId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapManagementInstanceSkillsPluginsSkillsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsPluginsSkillsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'skill_id',
            'skill_configuration_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
