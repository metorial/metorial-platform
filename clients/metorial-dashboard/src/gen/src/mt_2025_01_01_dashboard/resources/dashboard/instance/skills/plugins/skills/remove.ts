import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsPluginsSkillsRemoveOutput = {
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
};

export let mapDashboardInstanceSkillsPluginsSkillsRemoveOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsPluginsSkillsRemoveOutput>(
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
    ],
    1
  );
