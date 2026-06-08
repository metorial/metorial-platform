import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSkillsGroupsItemsGetOutput = {
  object: 'skill.group.item';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  skillGroupId: string;
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
};

export let mapDashboardInstanceSkillsGroupsItemsGetOutput =
  mtMap.object<DashboardInstanceSkillsGroupsItemsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    skillGroupId: mtMap.objectField('skill_group_id', mtMap.passthrough()),
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
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

