import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ConsumersDevicesListOutput = {
  object: 'list';
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
    detections: {
      object: 'consumer.device.detection';
      id: string;
      toolKey: string;
      toolName: string;
      state: 'installed' | 'running';
      confidence: 'high' | 'medium' | 'low';
      signalKinds: (
        'config_dir' | 'app' | 'path' | 'ide_extension' | 'process'
      )[];
      version: string | null;
      stale: boolean;
      firstSeenAt: Date;
      lastSeenAt: Date;
    }[];
    lastSeenAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: {
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    before?: string | undefined;
    after?: string | undefined;
  };
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
          [
            'detections',
            0,
            [
              2,
              [
                1,
                [
                  'tool_key',
                  'tool_name',
                  'signal_kinds',
                  'first_seen_at',
                  'last_seen_at'
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
