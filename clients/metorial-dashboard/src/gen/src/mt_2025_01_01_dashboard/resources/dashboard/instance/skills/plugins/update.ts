import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsPluginsUpdateOutput = {
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
} & { canUpdate: boolean; canDelete: boolean };

export let mapDashboardInstanceSkillsPluginsUpdateOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsPluginsUpdateOutput>(
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
    ],
    1
  );

export type DashboardInstanceSkillsPluginsUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
  longDescription?: string | null | undefined;
  category?: string | null | undefined;
  imageFileId?: string | null | undefined;
  skillConfigurationId?: string | null | undefined;
};

export let mapDashboardInstanceSkillsPluginsUpdateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsPluginsUpdateBody>([
    'long_description',
    'image_file_id',
    'skill_configuration_id'
  ]);
