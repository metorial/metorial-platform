import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationTeamsPermissionsOutput = {
  object: 'management.team.role_permissions';
  permissions: { id: string; name: string }[];
};

export let mapManagementOrganizationTeamsPermissionsOutput =
  mtMap.object<ManagementOrganizationTeamsPermissionsOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    permissions: mtMap.objectField(
      'permissions',
      mtMap.array(
        mtMap.object({
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough())
        })
      )
    )
  });
