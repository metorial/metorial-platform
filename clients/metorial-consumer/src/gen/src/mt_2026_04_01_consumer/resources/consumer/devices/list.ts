import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ConsumerDevicesListOutput = {
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
    telemetry: { enabled: boolean; tokenId: string | null };
    monitor: {
      aiToolDetection: boolean;
      catalogVersion: string;
      intervals: {
        configDirs: number;
        apps: number;
        binaries: number;
        ideExtensions: number;
        processes: number;
        report: number;
      };
    };
  }[];
  pagination: {
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    before?: string | undefined;
    after?: string | undefined;
  };
};

export let mapConsumerDevicesListOutput =
  /* @__PURE__ */ createMapper<ConsumerDevicesListOutput>(
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
          'updated_at',
          ['telemetry', 0, [1, ['token_id']]],
          [
            'monitor',
            0,
            [
              1,
              [
                'ai_tool_detection',
                'catalog_version',
                ['intervals', 0, [1, ['config_dirs', 'ide_extensions']]]
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type ConsumerDevicesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'active'
    | 'signed_out'
    | 'revoked'
    | ('active' | 'signed_out' | 'revoked')[]
    | undefined;
};

export let mapConsumerDevicesListQuery =
  /* @__PURE__ */ createMapper<ConsumerDevicesListQuery>(0);
