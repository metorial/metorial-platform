import { mapObject } from '@metorial/util-resource-mapper/compact';

export type TestHelpersConsumerOauthAuthorizationsCreateOutput = {
  object: 'test_helper.consumer_oauth_authorization';
  id: string;
  url: string;
  expiresAt: Date;
  createdAt: Date;
};

export let mapTestHelpersConsumerOauthAuthorizationsCreateOutput =
  /* @__PURE__ */ mapObject<TestHelpersConsumerOauthAuthorizationsCreateOutput>(
    ['expires_at', 'created_at'],
    1
  );

export type TestHelpersConsumerOauthAuthorizationsCreateBody = {
  instanceId: string;
  url: string;
  consumerProfileId: string;
  magicMcpEndpointId: string;
};

export let mapTestHelpersConsumerOauthAuthorizationsCreateBody =
  /* @__PURE__ */ mapObject<TestHelpersConsumerOauthAuthorizationsCreateBody>([
    'instance_id',
    'consumer_profile_id',
    'magic_mcp_endpoint_id'
  ]);
