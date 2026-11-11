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
        canUpdate: boolean;
        canDelete: boolean;
        canEditSkills: boolean;
      })
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
                                      'skill_group',
                                      [
                                        'unsynced_skills',
                                        1,
                                        [2, [1, ['skill_id']]]
                                      ],
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
