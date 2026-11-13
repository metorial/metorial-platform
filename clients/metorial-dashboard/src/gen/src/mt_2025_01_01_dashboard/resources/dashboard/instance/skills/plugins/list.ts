import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsPluginsListOutput = {
  items: ({
    object: 'skill.plugin';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    syncStatus: 'pending' | 'processing' | 'synced';
    imageUrl: string;
    name: string;
    description: string | null;
    longDescription: string | null;
    category: string | null;
    slug: string;
    skillConfigurationId: string | null;
    source:
      | { type: 'manual' }
      | {
          type: 'skill_group';
          skillGroup: { id: string; name: string };
          unsyncedSkills: {
            skillId: string;
            reason: 'limit_exceeded';
            message: string;
          }[];
          lastSyncedAt: Date | null;
        };
    skills: {
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
        image: {
          object: 'skill.image';
          type: 'file' | 'url' | 'icon' | 'default';
          icon: string | null;
          color: string | null;
        };
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
    createdAt: Date;
    updatedAt: Date;
  } & {
    skills: ({
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
        image: {
          object: 'skill.image';
          type: 'file' | 'url' | 'icon' | 'default';
          icon: string | null;
          color: string | null;
        };
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
    } & { canRead: boolean })[];
    source:
      | { type: 'manual' }
      | {
          type: 'skill_group';
          skillGroup: { id: string; name: string; canRead: boolean };
          unsyncedSkills: {
            skillId: string;
            reason: 'limit_exceeded';
            message: string;
          }[];
          lastSyncedAt: Date | null;
        };
    canUpdate: boolean;
    canDelete: boolean;
    canEditSkills: boolean;
  })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSkillsPluginsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsPluginsListOutput>(
    [
      7,
      [
        3,
        [
          [
            0,
            [
              1,
              [
                'sync_status',
                'image_url',
                'long_description',
                'skill_configuration_id',
                [
                  'source',
                  0,
                  [
                    3,
                    [
                      [
                        0,
                        [
                          1,
                          [
                            ['skill_group', 1, [1, ['can_read']]],
                            ['unsynced_skills', 1, [2, [1, ['skill_id']]]],
                            'last_synced_at'
                          ]
                        ]
                      ]
                    ]
                  ]
                ],
                [
                  'skills',
                  0,
                  [
                    2,
                    [
                      3,
                      [
                        [
                          0,
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
                              'updated_at',
                              'can_read'
                            ]
                          ]
                        ]
                      ]
                    ]
                  ]
                ],
                'created_at',
                'updated_at',
                'can_update',
                'can_delete',
                'can_edit_skills'
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSkillsPluginsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  skillMarketplaceId?: string | string[] | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  category?: string | undefined;
  search?: string | undefined;
  skillConfigurationId?: string | string[] | undefined;
  skillGroupId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceSkillsPluginsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsPluginsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'skill_marketplace_id',
            'skill_configuration_id',
            'skill_group_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
