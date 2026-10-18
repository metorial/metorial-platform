import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ createMapper<DashboardOrganizationsOauthScopesListOutput>(0);

export type DashboardOrganizationsOauthScopesListQuery = {
  subjectType?: 'organization_member' | 'consumer' | undefined;
};

export let mapDashboardOrganizationsOauthScopesListQuery =
  /* @__PURE__ */ mapObject<DashboardOrganizationsOauthScopesListQuery>([
    'subject_type'
  ]);
