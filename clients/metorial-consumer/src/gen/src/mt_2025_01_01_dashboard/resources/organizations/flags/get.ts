import { mtMap } from '@metorial/util-resource-mapper';

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

