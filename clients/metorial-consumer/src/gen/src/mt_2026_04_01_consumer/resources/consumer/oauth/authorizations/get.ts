import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ConsumerOauthAuthorizationsGetOutput = {
  object: 'consumer.oauth_authorization';
  id: string;
  status: 'active' | 'revoked';
  scopes: { identifier: string; name: string; description: string }[];
  oauthApplication: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string;
    websiteUrl: string | null;
  };
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export let mapConsumerOauthAuthorizationsGetOutput =
  /* @__PURE__ */ mapObject<ConsumerOauthAuthorizationsGetOutput>(
    [
      ['oauth_application', 1, [1, ['image_url', 'website_url']]],
      'last_used_at',
      'revoked_at',
      'created_at'
    ],
    1
  );
