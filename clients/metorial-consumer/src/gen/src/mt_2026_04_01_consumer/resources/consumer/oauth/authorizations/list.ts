import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ConsumerOauthAuthorizationsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapConsumerOauthAuthorizationsListOutput =
  /* @__PURE__ */ createMapper<ConsumerOauthAuthorizationsListOutput>(
    [
      7,
      [
        1,
        [
          ['oauth_application', 1, [1, ['image_url', 'website_url']]],
          'last_used_at',
          'revoked_at',
          'created_at'
        ]
      ]
    ],
    1
  );

export type ConsumerOauthAuthorizationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { status?: 'active' | 'revoked' | ('active' | 'revoked')[] | undefined };

export let mapConsumerOauthAuthorizationsListQuery =
  /* @__PURE__ */ createMapper<ConsumerOauthAuthorizationsListQuery>(0);
