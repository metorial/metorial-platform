import { mtMap } from '@metorial/util-resource-mapper';

export type OrganizationsFlagsGetQuery = {
  projectId?: string | undefined;
};

export let mapOrganizationsFlagsGetQuery = mtMap.object<OrganizationsFlagsGetQuery>({
  projectId: mtMap.objectField('project_id', mtMap.passthrough())
});

export type OrganizationsFlagsGetOutput = {
  object: 'flags';
  flags: { slug: string; value: boolean }[];
};

export let mapOrganizationsFlagsGetOutput =
  mtMap.object<OrganizationsFlagsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    flags: mtMap.objectField(
      'flags',
      mtMap.array(
        mtMap.object({
          slug: mtMap.objectField('slug', mtMap.passthrough()),
          value: mtMap.objectField('value', mtMap.passthrough())
        })
      )
    )
  });
