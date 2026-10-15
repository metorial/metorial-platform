import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsMarketplacesCreateOutput = {
  object: 'skill.marketplace';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  repositoryAccessMode: 'pull_request' | 'default_branch';
  forceMergeOrPush: boolean;
  mergeBeforeChecksPass: boolean;
  syncStatus: 'pending' | 'processing' | 'synced';
  imageUrl: string;
  name: string;
  description: string | null;
  slug: string;
  skillConfigurationId: string | null;
  plugins: {
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
  }[];
  createdAt: Date;
  updatedAt: Date;
} & {
  canCreatePlugins: boolean;
  plugins: ({
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
};

export let mapDashboardInstanceSkillsMarketplacesCreateOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsMarketplacesCreateOutput>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'repository_access_mode',
              'force_merge_or_push',
              'merge_before_checks_pass',
              'sync_status',
              'image_url',
              'skill_configuration_id',
              [
                'plugins',
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
                ]
              ],
              'created_at',
              'updated_at',
              'can_create_plugins'
            ]
          ]
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSkillsMarketplacesCreateBody = {
  name: string;
  description?: string | null | undefined;
  imageFileId?: string | null | undefined;
  skillConfigurationId?: string | null | undefined;
  repositoryAccessMode?: 'pull_request' | 'default_branch' | undefined;
  forceMergeOrPush?: boolean | undefined;
  mergeBeforeChecksPass?: boolean | undefined;
};

export let mapDashboardInstanceSkillsMarketplacesCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsMarketplacesCreateBody>([
    'image_file_id',
    'skill_configuration_id',
    'repository_access_mode',
    'force_merge_or_push',
    'merge_before_checks_pass'
  ]);
