import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSkillsPluginsSkillsAddOutput = {
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
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceSkillsPluginsSkillsAddOutput =
  mtMap.object<DashboardInstanceSkillsPluginsSkillsAddOutput>({
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
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceSkillsPluginsSkillsAddBody = {
  skillId: string;
  identifier?: string | undefined;
  clientName?: string | null | undefined;
  clientDescription?: string | null | undefined;
  clientMetadata?: Record<string, any> | null | undefined;
  license?: string | null | undefined;
  compatibility?: string | null | undefined;
  skillConfigurationId?: string | null | undefined;
};

export let mapDashboardInstanceSkillsPluginsSkillsAddBody =
  mtMap.object<DashboardInstanceSkillsPluginsSkillsAddBody>({
    skillId: mtMap.objectField('skill_id', mtMap.passthrough()),
    identifier: mtMap.objectField('identifier', mtMap.passthrough()),
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

