import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ConsumersDevicesListOutput = {
  items: {
    object: 'consumer.device';
    id: string;
    status: 'active' | 'signed_out' | 'revoked';
    consumerProfileId: string;
    name: string;
    os: string;
    arch: string;
    appVersion: string;
    clients: {
      object: 'consumer.device.client';
      key: string;
      name: string;
      detected: boolean;
      installable: boolean;
      supportsSkills: boolean;
      enabled: boolean;
      excludedMagicMcpServerIds: string[];
      excludedSkillIds: string[];
    }[];
    lastSeenAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapConsumersDevicesListOutput =
  /* @__PURE__ */ createMapper<ConsumersDevicesListOutput>(
    [
      7,
      [
        1,
        [
          'consumer_profile_id',
          'app_version',
          [
            'clients',
            0,
            [
              2,
              [
                1,
                [
                  'supports_skills',
                  'excluded_magic_mcp_server_ids',
                  'excluded_skill_ids'
                ]
              ]
            ]
          ],
          'last_seen_at',
          'revoked_at',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ConsumersDevicesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  consumerProfileId?: string | string[] | undefined;
  consumerId?: string | string[] | undefined;
  status?:
    | 'active'
    | 'signed_out'
    | 'revoked'
    | ('active' | 'signed_out' | 'revoked')[]
    | undefined;
};

export let mapConsumersDevicesListQuery =
  /* @__PURE__ */ createMapper<ConsumersDevicesListQuery>([
    3,
    [[0, [1, ['consumer_profile_id', 'consumer_id']]]]
  ]);
