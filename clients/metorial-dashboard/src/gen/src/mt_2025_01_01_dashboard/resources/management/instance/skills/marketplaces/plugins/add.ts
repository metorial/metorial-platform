import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsMarketplacesPluginsAddOutput = {
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
};

export let mapManagementInstanceSkillsMarketplacesPluginsAddOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsMarketplacesPluginsAddOutput>(
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
    ],
    1
  );

export type ManagementInstanceSkillsMarketplacesPluginsAddBody = {
  skillPluginId: string;
  skillConfigurationId?: string | null | undefined;
  identifier?: string | undefined;
};

export let mapManagementInstanceSkillsMarketplacesPluginsAddBody =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsMarketplacesPluginsAddBody>(
    ['skill_plugin_id', 'skill_configuration_id']
  );
