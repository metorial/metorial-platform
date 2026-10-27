import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureResourceOwnershipUpdateOutput = {
  object: 'organization.project.resource_ownership_configuration';
  projectId: string;
  allowApiAccessToConsumerOwnedResources: boolean;
  allowMemberAccessToConsumerOwnedResources: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureResourceOwnershipUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureResourceOwnershipUpdateOutput>(
    [
      'project_id',
      'allow_api_access_to_consumer_owned_resources',
      'allow_member_access_to_consumer_owned_resources',
      'updated_at'
    ],
    1
  );

export type DashboardProjectsConfigureResourceOwnershipUpdateBody = {
  allowApiAccessToConsumerOwnedResources?: boolean | undefined;
  allowMemberAccessToConsumerOwnedResources?: boolean | undefined;
};

export let mapDashboardProjectsConfigureResourceOwnershipUpdateBody =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureResourceOwnershipUpdateBody>(
    [
      'allow_api_access_to_consumer_owned_resources',
      'allow_member_access_to_consumer_owned_resources'
    ]
  );
