import { mtMap } from '@metorial/util-resource-mapper';

export type TestHelpersConsumerOauthAuthorizationsCreateOutput = {
  object: 'test_helper.consumer_oauth_authorization';
  id: string;
  url: string;
  expiresAt: Date;
  createdAt: Date;
};

export let mapTestHelpersConsumerOauthAuthorizationsCreateOutput =
  mtMap.object<TestHelpersConsumerOauthAuthorizationsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

export type TestHelpersConsumerOauthAuthorizationsCreateBody = {
  instanceId: string;
  url: string;
  consumerProfileId: string;
  magicMcpEndpointId: string;
};

export let mapTestHelpersConsumerOauthAuthorizationsCreateBody =
  mtMap.object<TestHelpersConsumerOauthAuthorizationsCreateBody>({
    instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    consumerProfileId: mtMap.objectField(
      'consumer_profile_id',
      mtMap.passthrough()
    ),
    magicMcpEndpointId: mtMap.objectField(
      'magic_mcp_endpoint_id',
      mtMap.passthrough()
    )
  });

