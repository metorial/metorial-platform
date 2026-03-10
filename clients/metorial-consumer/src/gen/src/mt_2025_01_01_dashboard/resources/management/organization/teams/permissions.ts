import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationTeamsPermissionsOutput = {
  object: 'management.team.role_permissions';
  permissions: {
    identifier: string;
    name: string;
    description: string;
    dependencies: string[];
  }[];
};

export let mapManagementOrganizationTeamsPermissionsOutput =
  mtMap.object<ManagementOrganizationTeamsPermissionsOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    permissions: mtMap.objectField(
      'permissions',
      mtMap.array(
        mtMap.object({
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          dependencies: mtMap.objectField(
            'dependencies',
            mtMap.array(mtMap.passthrough())
          )
        })
      )
    )
  });

