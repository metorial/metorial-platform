import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSkillsPluginsSkillsUpdateOutput = {
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

export let mapDashboardInstanceSkillsPluginsSkillsUpdateOutput =
  mtMap.object<DashboardInstanceSkillsPluginsSkillsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    identifier: mtMap.objectField('identifier', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    clientName: mtMap.objectField('client_name', mtMap.passthrough()),
    clientDescription: mtMap.objectField(
      'client_description',
      mtMap.passthrough()
    ),
    clientMetadata: mtMap.objectField('client_metadata', mtMap.passthrough()),
    license: mtMap.objectField('license', mtMap.passthrough()),
    compatibility: mtMap.objectField('compatibility', mtMap.passthrough()),
    skillConfigurationId: mtMap.objectField(
      'skill_configuration_id',
      mtMap.passthrough()
    ),
    skillId: mtMap.objectField('skill_id', mtMap.passthrough()),
    skill: mtMap.objectField(
      'skill',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
        clientName: mtMap.objectField('client_name', mtMap.passthrough()),
        clientDescription: mtMap.objectField(
          'client_description',
          mtMap.passthrough()
        ),
        clientMetadata: mtMap.objectField(
          'client_metadata',
          mtMap.passthrough()
        ),
        license: mtMap.objectField('license', mtMap.passthrough()),
        compatibility: mtMap.objectField('compatibility', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceSkillsPluginsSkillsUpdateBody = {
  clientName?: string | null | undefined;
  clientDescription?: string | null | undefined;
  clientMetadata?: Record<string, any> | null | undefined;
  license?: string | null | undefined;
  compatibility?: string | null | undefined;
  skillConfigurationId?: string | null | undefined;
};

export let mapDashboardInstanceSkillsPluginsSkillsUpdateBody =
  mtMap.object<DashboardInstanceSkillsPluginsSkillsUpdateBody>({
    clientName: mtMap.objectField('client_name', mtMap.passthrough()),
    clientDescription: mtMap.objectField(
      'client_description',
      mtMap.passthrough()
    ),
    clientMetadata: mtMap.objectField('client_metadata', mtMap.passthrough()),
    license: mtMap.objectField('license', mtMap.passthrough()),
    compatibility: mtMap.objectField('compatibility', mtMap.passthrough()),
    skillConfigurationId: mtMap.objectField(
      'skill_configuration_id',
      mtMap.passthrough()
    )
  });

