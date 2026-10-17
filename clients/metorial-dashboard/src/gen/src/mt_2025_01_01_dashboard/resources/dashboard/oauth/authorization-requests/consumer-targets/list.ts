import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOauthAuthorizationRequestsConsumerTargetsListOutput = {
  items: {
    object: 'machine_access.oauth_authorization_request.consumer_target';
    consumerProfileId: string;
    portal: { id: string; name: string; slug: string } | null;
    organization: { id: string; name: string };
    instance: { id: string; name: string };
    consumer: { name: string; email: string };
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOauthAuthorizationRequestsConsumerTargetsListOutput =
  /* @__PURE__ */ createMapper<DashboardOauthAuthorizationRequestsConsumerTargetsListOutput>(
    [7, [1, ['consumer_profile_id']]]
  );
