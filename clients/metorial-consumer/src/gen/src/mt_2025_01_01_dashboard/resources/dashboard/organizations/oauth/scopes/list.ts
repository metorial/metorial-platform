import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsOauthScopesListOutput = {
  object: 'management.oauth.scopes';
  permissions: {
    identifier: string;
    name: string;
    description: string;
    dependencies: string[];
  }[];
};

export let mapDashboardOrganizationsOauthScopesListOutput =
  mtMap.object<DashboardOrganizationsOauthScopesListOutput>({
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

