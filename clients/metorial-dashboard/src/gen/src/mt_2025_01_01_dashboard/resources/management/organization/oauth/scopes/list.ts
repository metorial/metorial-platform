import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationOauthScopesListOutput = {
  object: 'management.oauth.scopes';
  permissions: {
    identifier: string;
    name: string;
    description: string;
    dependencies: string[];
  }[];
};

export let mapManagementOrganizationOauthScopesListOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationOauthScopesListOutput>(0);
