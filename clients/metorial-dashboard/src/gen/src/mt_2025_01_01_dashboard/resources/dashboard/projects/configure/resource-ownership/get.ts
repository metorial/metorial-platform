import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureResourceOwnershipGetOutput = {
  object: 'organization.project.resource_ownership_configuration';
  projectId: string;
  allowApiAccessToConsumerOwnedResources: boolean;
  allowMemberAccessToConsumerOwnedResources: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureResourceOwnershipGetOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureResourceOwnershipGetOutput>(
    [
      'project_id',
      'allow_api_access_to_consumer_owned_resources',
      'allow_member_access_to_consumer_owned_resources',
      'updated_at'
    ],
    1
  );
