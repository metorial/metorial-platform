import { mtMap } from '@metorial/util-resource-mapper';

export type OrganizationsScopesGetOutput = {
  object: 'organization_scopes';
  scopes: string[];
};

export let mapOrganizationsScopesGetOutput =
  mtMap.object<OrganizationsScopesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    scopes: mtMap.objectField('scopes', mtMap.array(mtMap.passthrough()))
  });

