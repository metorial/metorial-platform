import { createMapper } from '@metorial/util-resource-mapper/compact';

export type OrganizationsScopesGetOutput = {
  object: 'organization_scopes';
  scopes: string[];
};

export let mapOrganizationsScopesGetOutput =
  /* @__PURE__ */ createMapper<OrganizationsScopesGetOutput>(0);
