import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePublicMcpServersDeleteOutput = {
  object: 'provider.public_mcp_server';
  id: string;
  status: 'active' | 'disabled' | 'archived' | 'deleted';
  slug: string;
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  connectUrl: string;
  alternateConnectUrls: string[];
  providerId: string;
  deployment: {
    object: 'provider.deployment#preview';
    id: string;
    isDefault: boolean;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  toolFilter:
    | { type: 'allow_all'; ignoreParentFilters: boolean }
    | {
        type: 'filter';
        filters: (
          | { type: 'tool_keys'; keys: string[] }
          | { type: 'tool_categories'; keys: string[] }
          | { type: 'tool_regex'; pattern: string }
          | { type: 'resource_regex'; pattern: string }
          | { type: 'resource_uris'; uris: string[] }
          | { type: 'prompt_keys'; keys: string[] }
          | { type: 'prompt_regex'; pattern: string }
        )[];
        ignoreParentFilters: boolean;
      };
  redirectUriFilters: string[];
  maxActiveGrants: number | null;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  grantIdleExpirySeconds: number;
  access: {
    source: 'explorer' | null;
    type: 'public' | 'owner_locked';
    visibility: 'anyone' | 'owner';
    owner: {
      type: 'person' | 'agent' | 'consumer' | 'organization_member';
      name: string | null;
      imageUrl: string | null;
      email: string | null;
      organizationMember?: { id: string } | undefined;
      consumer?:
        { id: string; profileId: string; portalId: string | null } | undefined;
    } | null;
  };
  disabledAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstancePublicMcpServersDeleteOutput =
  /* @__PURE__ */ mapObject<DashboardInstancePublicMcpServersDeleteOutput>(
    [
      'connect_url',
      'alternate_connect_urls',
      'provider_id',
      [
        'deployment',
        0,
        [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
      ],
      ['tool_filter', 1, [3, [[0, [1, ['ignore_parent_filters']]]]]],
      'redirect_uri_filters',
      'max_active_grants',
      'access_token_ttl_seconds',
      'refresh_token_ttl_seconds',
      'grant_idle_expiry_seconds',
      [
        'access',
        0,
        [
          1,
          [
            [
              'owner',
              0,
              [
                1,
                [
                  'image_url',
                  'organization_member',
                  ['consumer', 0, [1, ['profile_id', 'portal_id']]]
                ]
              ]
            ]
          ]
        ]
      ],
      'disabled_at',
      'archived_at',
      'created_at',
      'updated_at'
    ],
    1
  );
