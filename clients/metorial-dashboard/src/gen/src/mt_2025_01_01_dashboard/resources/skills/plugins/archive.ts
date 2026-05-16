import { mtMap } from '@metorial/util-resource-mapper';

export type SkillsPluginsArchiveOutput = {
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
    createdAt: Date;
    updatedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapSkillsPluginsArchiveOutput =
  mtMap.object<SkillsPluginsArchiveOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    syncStatus: mtMap.objectField('sync_status', mtMap.passthrough()),
    imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    longDescription: mtMap.objectField('long_description', mtMap.passthrough()),
    category: mtMap.objectField('category', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    skillConfigurationId: mtMap.objectField(
      'skill_configuration_id',
      mtMap.passthrough()
    ),
    skills: mtMap.objectField(
      'skills',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
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
          compatibility: mtMap.objectField(
            'compatibility',
            mtMap.passthrough()
          ),
          skillConfigurationId: mtMap.objectField(
            'skill_configuration_id',
            mtMap.passthrough()
          ),
          skillId: mtMap.objectField('skill_id', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

