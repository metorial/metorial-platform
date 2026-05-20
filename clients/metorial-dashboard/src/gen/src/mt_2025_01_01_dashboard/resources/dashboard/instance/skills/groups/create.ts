import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSkillsGroupsCreateOutput = {
  object: 'skill.group';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  skills: {
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
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceSkillsGroupsCreateOutput =
  mtMap.object<DashboardInstanceSkillsGroupsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    skills: mtMap.objectField(
      'skills',
      mtMap.array(
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
          compatibility: mtMap.objectField(
            'compatibility',
            mtMap.passthrough()
          ),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceSkillsGroupsCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  skillIds?: string[] | undefined;
};

export let mapDashboardInstanceSkillsGroupsCreateBody =
  mtMap.object<DashboardInstanceSkillsGroupsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    skillIds: mtMap.objectField('skill_ids', mtMap.array(mtMap.passthrough()))
  });

