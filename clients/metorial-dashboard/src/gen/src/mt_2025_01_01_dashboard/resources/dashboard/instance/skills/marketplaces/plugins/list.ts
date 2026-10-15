import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsMarketplacesPluginsListOutput = {
  items: ({
    object: 'skill.marketplace_plugin';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    identifier: string;
    skillConfigurationId: string | null;
    skillMarketplaceId: string | null;
    skillPlugin: {
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
    } | null;
    createdAt: Date;
    updatedAt: Date;
  } & {
    skillPlugin:
      | ({
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
        } & { canUpdate: boolean; canDelete: boolean })
      | null;
  })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSkillsMarketplacesPluginsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsMarketplacesPluginsListOutput>(
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
                'skill_configuration_id',
                'skill_marketplace_id',
                [
                  'skill_plugin',
                  1,
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
                              'skills',
                              0,
                              [
                                2,
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
                              ]
                            ],
                            'created_at',
                            'updated_at',
                            'can_update',
                            'can_delete'
                          ]
                        ]
                      ]
                    ]
                  ]
                ],
                'created_at',
                'updated_at'
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSkillsMarketplacesPluginsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  skillPluginId?: string | string[] | undefined;
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

export let mapDashboardInstanceSkillsMarketplacesPluginsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsMarketplacesPluginsListQuery>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'skill_plugin_id',
              'skill_configuration_id',
              ['created_at', 1, 5],
              ['updated_at', 1, 5]
            ]
          ]
        ]
      ]
    ]
  );
